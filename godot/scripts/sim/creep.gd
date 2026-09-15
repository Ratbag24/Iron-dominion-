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
const GROW: float = 0.08
const SPREAD_FROM: float = 0.55
const DECAY: float = 0.035
const SOURCE_RATE: float = 0.22

## Corruption at which a cell counts as the hive's ground.
const CREEP_HELD: float = 0.4
const CREEP_SPEED_OWN: float = 1.25
const CREEP_SPEED_OTHER: float = 0.8
const CREEP_REGEN: float = 0.012


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
static func update_creep(world: IdWorld, _dt: float) -> void:
	if world.tick_count % CREEP_INTERVAL != 0:
		return
	var map: IdGameMap = world.map
	var corr: PackedFloat32Array = map.corruption

	for e in world.entities:
		if not e.alive:
			continue
		var radius: float = float(e.def.get("creep", 0.0))
		if radius <= 0.0 or not spreads_creep(world, e.player):
			continue
		var strength := 0.5 if e.under_construction else 1.0
		_seed(map, e.x, e.y, radius, SOURCE_RATE * strength)

	# Spread from established cells and decay everywhere, reading a snapshot
	# so the pass cannot chase itself across a row. The whole grid is walked
	# here: at 192x192 that is 37k cells twice a second, which is the single
	# most expensive thing left in GDScript and the first candidate for C#.
	var cols: int = map.cols
	var rows: int = map.rows
	var snap: PackedFloat32Array = corr.duplicate()
	var terrain: PackedByteArray = map.terrain
	for cy in rows:
		var row := cy * cols
		for cx in cols:
			var i := row + cx
			if terrain[i] == IdGameMap.TERRAIN_WATER:
				corr[i] = 0.0
				continue
			var v: float = snap[i] - DECAY
			var best := 0.0
			if cx > 0 and snap[i - 1] >= SPREAD_FROM:
				best = maxf(best, snap[i - 1])
			if cx < cols - 1 and snap[i + 1] >= SPREAD_FROM:
				best = maxf(best, snap[i + 1])
			if cy > 0 and snap[i - cols] >= SPREAD_FROM:
				best = maxf(best, snap[i - cols])
			if cy < rows - 1 and snap[i + cols] >= SPREAD_FROM:
				best = maxf(best, snap[i + cols])
			var ceiling := best - STEP
			if ceiling > v:
				v = minf(ceiling, snap[i] + GROW)
			corr[i] = clampf(v, 0.0, 1.0)
	map.corruption = corr


static func _seed(map: IdGameMap, x: float, y: float, radius: float, rate: float) -> void:
	var corr: PackedFloat32Array = map.corruption
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
	map.corruption = corr


## Per-tick effects of standing on corrupted ground.
static func apply_creep_effects(world: IdWorld, dt: float) -> void:
	var map: IdGameMap = world.map
	for e in world.entities:
		if not e.alive or e.is_building or float(e.def.get("speed", 0.0)) <= 0.0:
			continue
		if String(e.def.get("layer", "ground")) == "air":
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
