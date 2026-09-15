class_name IdCreep
extends RefCounted

## The hive's infection of the ground. A port of src/sim/creep.js.
##
## Every Blight structure, and to a lesser degree every Blight body, seeps
## corruption into the cells around it; corruption spreads to its neighbours
## and slowly dies back where nothing feeds it. The result is a living stain
## that grows out from the hive's base, follows its army across the map, and
## recedes when the source is killed.
##
## It is also a mechanic: the hive moves faster on its own ground and heals
## there; everyone else is slowed wading through it.

## Simulation ticks between spread passes.
const CREEP_INTERVAL: int = 15
## Spread is a ceiling, not an addition: see the note in creep.js. A cell can
## rise to STEP below its strongest established neighbour, by at most GROW per
## pass, and no higher.
const STEP: float = 0.06
const STEP_DIAG: float = STEP * 1.414
const GROW: float = 0.08
const SPREAD_FROM: float = 0.55
const DECAY: float = 0.035
const SOURCE_RATE: float = 0.22

## Corruption at which a cell counts as the hive's ground.
const CREEP_HELD: float = 0.4
## Corruption a hive structure needs under it to be grown.
const CREEP_BUILD: float = 0.3
const CREEP_SPEED_OWN: float = 1.18
const CREEP_SPEED_OTHER: float = 0.8
const CREEP_REGEN: float = 0.008


static func spreads_creep(world: IdWorld, player_index: int) -> bool:
	if player_index < 0 or player_index >= world.players.size():
		return false
	var p: IdPlayer = world.players[player_index]
	return bool(IdUnitDefs.faction(p.faction).get("spreadsCreep", false))


static func creep_at(map: IdGameMap, x: float, y: float) -> float:
	var cx := int(x / float(map.cell))
	var cy := int(y / float(map.cell))
	if not map.in_bounds(cx, cy):
		return 0.0
	return map.corruption[map.idx(cx, cy)]


## One spread pass, every CREEP_INTERVAL ticks.
##
## Only cells that are corrupted or next to a corrupted cell are visited:
## the rest are zero with zero neighbours and cannot change, so the pass
## costs what the creep covers rather than the whole map, which at 192x192
## was a 15ms hitch twice a second. Seeds add their cells and the ring
## around them before the pass; the pass builds the next list from what it
## leaves non-zero. The first pass walks everything. The values are exactly
## those of the full walk.
static func update_creep(world: IdWorld, _dt: float) -> void:
	if world.tick_count % CREEP_INTERVAL != 0:
		return
	var map: IdGameMap = world.map
	var cols: int = map.cols
	var rows: int = map.rows
	var count: int = cols * rows

	if world.creep_mark.size() != count:
		var mark0 := PackedByteArray()
		mark0.resize(count)
		mark0.fill(1)
		world.creep_mark = mark0
		world.creep_gen = 1
		world.creep_active.clear()
		for i in count:
			world.creep_active.append(i)

	for e in world.entities:
		if not e.alive:
			continue
		var radius: float = float(e.def.get("creep", 0.0))
		if radius <= 0.0 or not spreads_creep(world, e.player):
			continue
		var strength := 0.5 if e.under_construction else 1.0
		_seed(world, e.x, e.y, radius, SOURCE_RATE * strength)

	# Spread from established cells and decay everywhere, reading a snapshot
	# so the pass cannot chase itself across a row.
	var corr: PackedFloat32Array = map.corruption
	var snap: PackedFloat32Array = corr.duplicate()
	var terrain: PackedByteArray = map.terrain
	var active: Array = world.creep_active
	var mark: PackedByteArray = world.creep_mark
	var next_gen: int = world.creep_gen + 1
	if next_gen > 250:
		mark.fill(0)
		next_gen = 1
	var next: Array = []
	for i in active:
		if terrain[i] == IdGameMap.TERRAIN_WATER:
			corr[i] = 0.0
			continue
		var cx: int = i % cols
		var cy: int = i / cols
		var v: float = snap[i] - DECAY
		# All eight neighbours, the diagonals a longer step: with only
		# four the front grew as a diamond and read as a square stain.
		var ceiling := 0.0
		var left := cx > 0
		var right := cx < cols - 1
		var up := cy > 0
		var down := cy < rows - 1
		if left and snap[i - 1] >= SPREAD_FROM:
			ceiling = maxf(ceiling, snap[i - 1] - STEP)
		if right and snap[i + 1] >= SPREAD_FROM:
			ceiling = maxf(ceiling, snap[i + 1] - STEP)
		if up and snap[i - cols] >= SPREAD_FROM:
			ceiling = maxf(ceiling, snap[i - cols] - STEP)
		if down and snap[i + cols] >= SPREAD_FROM:
			ceiling = maxf(ceiling, snap[i + cols] - STEP)
		if up and left and snap[i - cols - 1] >= SPREAD_FROM:
			ceiling = maxf(ceiling, snap[i - cols - 1] - STEP_DIAG)
		if up and right and snap[i - cols + 1] >= SPREAD_FROM:
			ceiling = maxf(ceiling, snap[i - cols + 1] - STEP_DIAG)
		if down and left and snap[i + cols - 1] >= SPREAD_FROM:
			ceiling = maxf(ceiling, snap[i + cols - 1] - STEP_DIAG)
		if down and right and snap[i + cols + 1] >= SPREAD_FROM:
			ceiling = maxf(ceiling, snap[i + cols + 1] - STEP_DIAG)
		if ceiling > v:
			v = minf(ceiling, snap[i] + GROW)
		v = clampf(v, 0.0, 1.0)
		corr[i] = v
		if v <= 0.0:
			continue
		# Still corrupted: it and its ring are visited next pass.
		var x0: int = cx - 1 if left else cx
		var x1: int = cx + 1 if right else cx
		var y0: int = cy - 1 if up else cy
		var y1: int = cy + 1 if down else cy
		for ny in range(y0, y1 + 1):
			var row: int = ny * cols
			for nx in range(x0, x1 + 1):
				var n: int = row + nx
				if mark[n] != next_gen:
					mark[n] = next_gen
					next.append(n)
	world.creep_active = next
	world.creep_mark = mark
	world.creep_gen = next_gen
	map.corruption = corr


static func _seed(world: IdWorld, x: float, y: float, radius: float, rate: float) -> void:
	var map: IdGameMap = world.map
	var corr: PackedFloat32Array = map.corruption
	var mark: PackedByteArray = world.creep_mark
	var active: Array = world.creep_active
	var gen: int = world.creep_gen
	var cols: int = map.cols
	var rows: int = map.rows
	var cx0 := int(x / float(map.cell))
	var cy0 := int(y / float(map.cell))
	var r := int(ceil(radius))
	for dy in range(-r, r + 1):
		for dx in range(-r, r + 1):
			var cx := cx0 + dx
			var cy := cy0 + dy
			if not map.in_bounds(cx, cy):
				continue
			var d := sqrt(float(dx * dx + dy * dy)) / radius
			if d > 1.0:
				continue
			var i := map.idx(cx, cy)
			if map.terrain[i] == IdGameMap.TERRAIN_WATER:
				continue
			var w := 1.0 - d * d
			corr[i] = minf(1.0, corr[i] + rate * w * (1.2 - corr[i]))
			# The pass must see this cell and the ring its ceiling reaches.
			for ny in range(maxi(cy - 1, 0), mini(cy + 1, rows - 1) + 1):
				var row: int = ny * cols
				for nx in range(maxi(cx - 1, 0), mini(cx + 1, cols - 1) + 1):
					var n: int = row + nx
					if mark[n] != gen:
						mark[n] = gen
						active.append(n)
	map.corruption = corr
	world.creep_mark = mark


## Per-tick effects of standing on corrupted ground.
static func apply_creep_effects(world: IdWorld, dt: float) -> void:
	var map: IdGameMap = world.map
	for e in world.entities:
		if not e.alive or e.is_building or float(e.def.get("speed", 0.0)) <= 0.0:
			continue
		if e.is_air:
			e.speed_scale = 1.0
			continue
		var c := creep_at(map, e.x, e.y)
		if c < CREEP_HELD:
			e.speed_scale = 1.0
			continue
		if spreads_creep(world, e.player):
			e.speed_scale = CREEP_SPEED_OWN
			if e.hp < e.max_hp and not e.under_construction:
				e.hp = minf(e.max_hp, e.hp + e.max_hp * CREEP_REGEN * dt)
		else:
			e.speed_scale = CREEP_SPEED_OTHER
