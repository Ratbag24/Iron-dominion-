class_name IdWorld
extends RefCounted

## The simulation world: entities, players, and the fixed-step tick that drives
## every subsystem in a defined order.
##
## Nothing here touches the scene tree. The renderer reads this state; it never
## writes to it. That separation is what let the whole simulation move from the
## browser build to Godot without being rewritten.

## How much health a converted unit keeps.
const CONVERT_HP: float = 0.4

const SIM_HZ: int = 30
## Cell size of the separation grid: a little over the widest reach a
## separation query has (radius + 22 for the largest ground unit), so a
## query touches four cells at most.
const NEAR_CELL: int = 40
const SIM_DT: float = 1.0 / 30.0

static var _next_entity_id: int = 1

var world_seed: int = 12345
var rng: IdRng
var map: IdGameMap
var pathfinder: IdPathfinder
var grid: IdSpatialGrid
## Moving units only, on fine cells, for separation. See spatial_grid.gd.
var near: IdSpatialGrid

var entities: Array[IdEntity] = []
var by_id: Dictionary = {}
var wrecks: Array[Dictionary] = []
var projectiles: Array[Dictionary] = []

## Transient visual events drained by the renderer each frame.
var effects: Array[Dictionary] = []

var time: float = 0.0
var tick_count: int = 0
var game_over: bool = false
var winner: int = -1
var commander_ends: bool = true

var wind_strength: float = 0.5

var players: Array[IdPlayer] = []
var fog: Array[IdFogMap] = []

## Build jobs registered this tick, grouped in the construction phase.
var build_jobs: Array[Dictionary] = []

var ais: Array = []

## Build jobs grouped by target, filled by the economy's pricing pass and
## consumed by construction in the same tick.
var job_groups: Dictionary = {}

## Scratch space for the neighbour queries the order and combat phases run
## every tick for every unit. Reused rather than allocated: at a few hundred
## units that is a few hundred arrays a tick, and their collection costs more
## than the searches do.
var assist_buf: Array = []
var enemy_buf: Array = []
## Per player, the indices of every player on its team (itself included), for
## the grid's enemy query. Fixed for the match, so built once.
var _allies: Array = []

## Per-phase microseconds from the last tick, when profiling is on. Off by
## default: reading the clock eight times a tick is not free.
var profile: bool = false
var phase_us: Dictionary = {}


func _init(opts: Dictionary = {}) -> void:
	world_seed = int(opts.get("seed", 12345)) & 0xFFFFFFFF
	rng = IdRng.new(world_seed ^ 0x51ed2701)
	var specs: Array = opts.get("players", [
		{"name": "Commander", "faction": "vanguard"},
		{"name": "Legion AI", "faction": "legion", "is_ai": true},
	])
	# The map is laid out for however many sides are playing, so every one of
	# them gets the same ground and the same spots within reach.
	map = IdGameMap.new(
		world_seed, int(opts.get("width", 3072)), int(opts.get("height", 3072)),
		specs.size()
	)
	pathfinder = IdPathfinder.new(map)
	commander_ends = bool(opts.get("commander_ends", true))

	for i in range(specs.size()):
		players.append(IdPlayer.new(i, specs[i]))
		fog.append(IdFogMap.new(map))
	_assign_colours()

	# The grid buckets by player and the allies table is read by every enemy
	# search, so both come after the players exist.
	grid = IdSpatialGrid.new(map.width, map.height, 96, players.size())
	near = IdSpatialGrid.new(map.width, map.height, NEAR_CELL, 0)
	_allies.resize(players.size())
	for i in players.size():
		var same := PackedInt32Array()
		for j in players.size():
			if players[j].team == players[i].team:
				same.append(j)
		_allies[i] = same

	# Start positions must exist before the AI reads them.
	_spawn_start(opts)

	ais.resize(players.size())
	for i in range(players.size()):
		ais[i] = IdAI.new(self, players[i]) if players[i].is_ai else null


## Give each player a colour from its team's family, so allies read as allies.
## Only the world knows how the teams fell out, so only the world can do this.
func _assign_colours() -> void:
	var seen: Dictionary = {}
	var order: Array = []
	for p in players:
		if not seen.has(p.team):
			seen[p.team] = order.size()
			order.append(p.team)
	var slots: Dictionary = {}
	for p in players:
		var slot: int = int(slots.get(p.team, 0))
		slots[p.team] = slot + 1
		p.color = IdPlayer.colour_for(int(seen[p.team]), slot)


func _spawn_start(opts: Dictionary) -> void:
	var starts: Array = map.start_positions
	var extra: int = int(opts.get("start_units", 0))
	for i in range(players.size()):
		var p: IdPlayer = players[i]
		var s: Dictionary = starts[i % starts.size()]
		var roster: Dictionary = IdUnitDefs.roster(p.faction)
		var com: IdEntity = spawn(roster["commander"], i, s["x"], s["y"], {"complete": true})
		p.start_x = s["x"]
		p.start_y = s["y"]
		p.commander_id = com.id
		for k in range(extra):
			var a: float = (float(k) / float(extra)) * TAU
			spawn(
				roster["builder"], i,
				s["x"] + cos(a) * 70.0, s["y"] + sin(a) * 70.0,
				{"complete": true}
			)
		fog[i].reveal_circle(s["x"], s["y"], 700.0)


# ----------------------------------------------------------------- entities

func spawn(def_id: String, player_index: int, x: float, y: float, opts: Dictionary = {}) -> IdEntity:
	var player: IdPlayer = players[player_index]
	var def: Dictionary = IdUnitDefs.get_def(def_id, player.faction)
	var building: bool = def.get("kind", "") == "building"
	var complete: bool = bool(opts.get("complete", true))
	var footprint: int = int(def.get("footprint", 0))

	var cx: int = 0
	var cy: int = 0
	if building:
		var snapped: Dictionary = map.snap_footprint(x, y, footprint)
		cx = snapped["cx"]
		cy = snapped["cy"]
		x = snapped["x"]
		y = snapped["y"]

	var e := IdEntity.new()
	e.id = _next_entity_id
	_next_entity_id += 1
	e.def_id = def_id
	e.def = def
	e.player = player_index
	e.x = x
	e.y = y
	e.cx = cx
	e.cy = cy
	e.heading = opts.get(
		"heading", -PI / 2.0 if building else rng.range_f(0.0, TAU)
	)
	e.radius = float(def.get("radius", 12.0))
	e.is_building = building
	e.max_hp = float(def.get("hp", 1))
	e.hp = e.max_hp if complete else maxf(1.0, e.max_hp * 0.05)
	e.under_construction = not complete
	e.build_progress = 1.0 if complete else 0.0
	e.last_x = x
	e.last_y = y

	e.mass = float(def.get("mass", 1.0))
	e.is_air = String(def.get("layer", "ground")) == "air"
	e.max_range = float(def.get("maxWeaponRange", 0.0))
	e.build_power = float(def.get("buildPower", 0.0))

	for w in def.get("weapons", []):
		e.weapons.append(IdWeapon.new(w, rng.range_f(0.0, float(w.get("reload", 1.0)))))
		var targets: String = String(w.get("targets", "ground"))
		if targets != "ground":
			e.hits_air = true
		if targets != "air":
			e.hits_ground = true

	if bool(def.get("needsMetalSpot", false)):
		var spot: Dictionary = map.metal_spot_near(x, y, IdGameMap.BUILD_CELL * 2)
		if not spot.is_empty():
			spot["taken"] = true
			spot["owner_id"] = e.id
			e.metal_spot = spot
			var snapped2: Dictionary = map.snap_footprint(spot["x"], spot["y"], footprint)
			e.cx = snapped2["cx"]
			e.cy = snapped2["cy"]
			e.x = snapped2["x"]
			e.y = snapped2["y"]

	if building:
		map.set_blocked(e.cx, e.cy, footprint, 1)
		pathfinder.update_footprint(e.cx, e.cy, footprint)

	entities.append(e)
	by_id[e.id] = e
	# A converted unit was not built, and counting it as built would make the
	# hive's production look like it out-produced everyone.
	if complete and not bool(opts.get("converted", false)):
		player.stats["built"] += 1
	return e


func get_entity(id: int) -> IdEntity:
	var e: IdEntity = by_id.get(id, null)
	return e if e != null and e.alive else null


func is_enemy(a: IdEntity, b: IdEntity) -> bool:
	return players[a.player].team != players[b.player].team


func add_effect(fx: Dictionary) -> void:
	fx["t"] = time
	effects.append(fx)
	if effects.size() > 900:
		effects = effects.slice(effects.size() - 900)


## `infect` is the chance, in [0, 1], that a killing blow takes the unit rather
## than leaving a wreck. It rides in from the weapon that fired.
func damage(
	target: IdEntity, amount: float, attacker: IdEntity, infect: float = 0.0
) -> void:
	if not target.alive or amount <= 0.0:
		return
	# Things still being built take extra damage, as in BAR: nanoframes are
	# fragile, which is what makes raiding construction worthwhile.
	if target.under_construction:
		amount *= 1.6
	target.hp -= amount
	target.last_damage_time = time
	if attacker != null:
		target.last_attacker_id = attacker.id
	if target.hp <= 0.0:
		kill(target, attacker, infect)


func kill(e: IdEntity, killer: IdEntity, infect: float = 0.0) -> void:
	if not e.alive:
		return
	e.alive = false
	e.hp = 0.0

	var player: IdPlayer = players[e.player]
	player.stats["lost"] += 1
	if killer != null:
		players[killer.player].stats["killed"] += 1

	if _convert(e, killer, infect):
		return

	if e.is_building:
		var footprint: int = int(e.def.get("footprint", 0))
		map.set_blocked(e.cx, e.cy, footprint, 0)
		pathfinder.update_footprint(e.cx, e.cy, footprint)
		if not e.metal_spot.is_empty():
			e.metal_spot["taken"] = false
			e.metal_spot["owner_id"] = -1

	var wreck_metal: float = float(e.def.get("wreckMetal", 0.0))
	if wreck_metal > 0.0:
		wrecks.append({
			"id": _next_entity_id,
			"x": e.x, "y": e.y,
			"def_id": e.def_id,
			"faction": e.def.get("faction", ""),
			"radius": e.radius,
			"metal": wreck_metal,
			"metal_left": wreck_metal,
			"reclaim_time": maxf(120.0, float(e.def.get("buildTime", 0.0)) * 0.35),
			"reclaim_progress": 0.0,
			"is_building": e.is_building,
			"heading": e.heading,
		})
		_next_entity_id += 1
		if wrecks.size() > 600:
			wrecks.remove_at(0)

	var size: float = (
		float(e.def.get("footprintPx", e.radius * 2.0)) * 0.9 if e.is_building
		else e.radius * 3.4
	)
	add_effect({
		"type": "explosion", "x": e.x, "y": e.y, "size": size,
		"big": e.is_building or float(e.def.get("hp", 0)) > 2000.0,
	})

	if commander_ends and bool(e.def.get("isCommander", false)):
		add_effect({
			"type": "explosion", "x": e.x, "y": e.y,
			"size": 420.0, "big": true, "nuke": true,
		})
		# A dying commander takes its surroundings with it.
		#
		# This one query keeps its own array rather than sharing the scratch
		# buffer: the damage below can kill a second commander inside the
		# blast, and that one's explosion would refill the buffer this loop is
		# still walking.
		var caught: Array = []
		grid.query(e.x, e.y, 260.0, caught)
		for other in caught:
			if other == e or not other.alive:
				continue
			var d: float = IdMath.dist(e.x, e.y, other.x, other.y)
			if d < 260.0:
				damage(other, 2200.0 * (1.0 - d / 260.0), e)
		player.defeated = true


## Take a killed unit for the killer's side instead of leaving a wreck.
##
## Only mobile units, and never a commander: a hive that could eat the thing
## the match is decided by would decide it on one lucky bite. The unit keeps
## its own definition - a captured tank is still a tank, and still shoots what
## a tank shoots - which also means it does not inherit the teeth that took it.
## Conversion stops with the unit that was converted.
func _convert(e: IdEntity, killer: IdEntity, infect: float) -> bool:
	if infect <= 0.0 or killer == null or not killer.alive:
		return false
	if e.is_building or bool(e.def.get("isCommander", false)):
		return false
	if float(e.def.get("speed", 0.0)) <= 0.0:
		return false
	if not is_enemy(e, killer):
		return false
	if rng.next() >= infect:
		return false

	var taken: IdEntity = spawn(e.def_id, killer.player, e.x, e.y, {
		"complete": true, "heading": e.heading, "converted": true,
	})
	# It comes over wounded. Taking a unit whole would make trading into the
	# hive strictly worse than not fighting at all.
	taken.hp = maxf(1.0, taken.max_hp * CONVERT_HP)
	var taker: IdPlayer = players[killer.player]
	taker.stats["converted"] = int(taker.stats.get("converted", 0)) + 1

	add_effect({
		"type": "convert", "x": e.x, "y": e.y,
		"player": killer.player, "size": e.radius * 3.2,
	})
	return true


## Every living entity of a player, optionally filtered by definition id.
func units_of(player_index: int, def_id: String = "") -> Array[IdEntity]:
	var out: Array[IdEntity] = []
	for e in entities:
		if not e.alive or e.player != player_index:
			continue
		if def_id != "" and e.def_id != def_id:
			continue
		out.append(e)
	return out


# --------------------------------------------------------------------- tick

func tick(dt: float = SIM_DT) -> void:
	if game_over:
		return
	time += dt
	tick_count += 1

	# Wind drifts slowly, so turbine output rises and falls over a match.
	wind_strength = 0.5 + 0.5 * sin(time * 0.055) * cos(time * 0.017 + 1.3)
	wind_strength = clampf(wind_strength * 0.5 + 0.5, 0.05, 1.0)

	var t0 := Time.get_ticks_usec() if profile else 0

	pathfinder.begin_tick()
	grid.clear()
	near.clear()
	for e in entities:
		if e.alive:
			grid.insert(e)
			if not e.is_building:
				near.insert(e)
	if profile:
		t0 = _mark("grid", t0)

	for i in range(ais.size()):
		if ais[i] != null and not players[i].defeated:
			ais[i].update(dt)
	if profile:
		_mark("ai", t0)

	if profile:
		_tick_profiled(dt)
	else:
		build_jobs.clear()
		for e in entities:
			if e.alive:
				IdOrders.update_orders(self, e, dt)

		IdEconomy.run_economy(self, dt)
		IdConstruction.apply_construction(self, dt)
		IdEconomy.settle_economy(self, dt)
		IdCreep.apply_creep_effects(self, dt)
		IdMovement.update_movement(self, dt)
		IdCombat.update_combat(self, dt)
		IdCreep.update_creep(self, dt)
		IdProjectiles.update_projectiles(self, dt)
		pathfinder.process_requests()

	var t1 := Time.get_ticks_usec() if profile else 0
	_cleanup()
	if profile:
		t1 = _mark("cleanup", t1)

	if (tick_count & 3) == 0:
		for i in range(players.size()):
			_update_fog(i)
	if profile:
		_mark("fog", t1)

	_check_victory()


## The same phases, timed. Kept apart from the plain path so profiling costs
## nothing when it is off.
func _tick_profiled(dt: float) -> void:
	var t := Time.get_ticks_usec()
	build_jobs.clear()
	for e in entities:
		if e.alive:
			IdOrders.update_orders(self, e, dt)
	t = _mark("orders", t)

	IdEconomy.run_economy(self, dt)
	IdConstruction.apply_construction(self, dt)
	IdEconomy.settle_economy(self, dt)
	t = _mark("economy", t)

	IdCreep.apply_creep_effects(self, dt)
	IdMovement.update_movement(self, dt)
	t = _mark("movement", t)

	IdCombat.update_combat(self, dt)
	t = _mark("combat", t)

	IdCreep.update_creep(self, dt)
	t = _mark("creep", t)

	IdProjectiles.update_projectiles(self, dt)
	t = _mark("projectiles", t)

	pathfinder.process_requests()
	_mark("pathfinding", t)


func _mark(name: String, since: int) -> int:
	var now := Time.get_ticks_usec()
	phase_us[name] = int(phase_us.get(name, 0)) + (now - since)
	return now


func allies_of(player_index: int) -> PackedInt32Array:
	return _allies[player_index]


func _update_fog(player_index: int) -> void:
	var f: IdFogMap = fog[player_index]
	f.begin_frame()
	var team: int = players[player_index].team
	# Reveals are batched: the fog map merges the discs into row spans and
	# writes each cell once, however many units can see it. Radar is rare
	# and goes through as it is.
	f.begin_batch()
	for e in entities:
		if not e.alive or players[e.player].team != team:
			continue
		f.add_circle(e.x, e.y, float(e.def.get("los", 200.0)))
		var radar: float = float(e.def.get("radar", 0.0))
		if radar > 0.0:
			f.reveal_radar(e.x, e.y, radar)
	f.end_batch()

	# Remember enemy structures we can currently see, and forget the ones we
	# can now see are gone.
	var live_ids: Dictionary = {}
	for e in entities:
		if not e.alive or not e.is_building:
			continue
		if players[e.player].team == team:
			continue
		live_ids[e.id] = true
		if f.is_visible_at(e.x, e.y):
			f.remember(e)
	f.forget_gone(live_ids)


func _cleanup() -> void:
	var write: int = 0
	for i in range(entities.size()):
		var e: IdEntity = entities[i]
		if e.alive:
			entities[write] = e
			write += 1
		else:
			by_id.erase(e.id)
	entities.resize(write)

	for i in range(wrecks.size() - 1, -1, -1):
		if float(wrecks[i]["metal_left"]) <= 0.01:
			wrecks.remove_at(i)


func _check_victory() -> void:
	var alive_teams: Dictionary = {}
	for e in entities:
		if e.alive and not players[e.player].defeated:
			alive_teams[players[e.player].team] = true
	for p in players:
		if p.defeated:
			continue
		if commander_ends:
			if get_entity(p.commander_id) == null:
				p.defeated = true
		elif not alive_teams.has(p.team):
			p.defeated = true

	var live: Dictionary = {}
	for p in players:
		if not p.defeated:
			live[p.team] = true
	if live.size() <= 1:
		game_over = true
		winner = live.keys()[0] if live.size() == 1 else -1


## Forget visual events older than `max_age`. The renderer calls this once it
## has drawn a frame: the effects list is the one piece of world state that
## exists purely for the view, and nothing in the simulation reads it back.
func prune_effects(max_age: float) -> void:
	var keep: Array[Dictionary] = []
	for fx in effects:
		if time - float(fx["t"]) < max_age:
			keep.append(fx)
	effects = keep


## Break the world <-> AI reference cycle so the whole graph can be freed.
## RefCounted cannot collect a cycle on its own, and each AI holds the world
## that holds it.
func dispose() -> void:
	for i in range(ais.size()):
		if ais[i] != null:
			ais[i].world = null
	ais.clear()
	entities.clear()
	by_id.clear()
	build_jobs.clear()
	job_groups.clear()
