class_name IdOrders

## Order execution. Each entity runs its current order every tick, which either
## sets a movement goal, registers a build job, or picks an attack target.
##
## Build jobs are collected here and resolved later in construction, after the
## economy has worked out how much of the demand it can actually pay for.

const MOVE: String = "move"
const ATTACK_MOVE: String = "attackMove"
const ATTACK: String = "attack"
const BUILD: String = "build"
const REPAIR: String = "repair"
const RECLAIM: String = "reclaim"
const GUARD: String = "guard"
const PATROL: String = "patrol"

const ARRIVE_SLACK: float = 26.0


static func update_orders(world: IdWorld, e: IdEntity, _dt: float) -> void:
	if e.under_construction:
		# A nanoframe does nothing until it is finished.
		e.has_move_goal = false
		return

	var build_power: float = float(e.def.get("buildPower", 0.0))

	# Factories keep producing regardless of any other order they hold.
	if bool(e.def.get("factory", false)) and not e.factory_queue.is_empty():
		world.build_jobs.append({
			"builder": e, "kind": "produce", "target": e, "power": build_power,
		})

	# Idle construction turrets look for something nearby to help with.
	if bool(e.def.get("assistOnly", false)):
		auto_assist(world, e)
		return

	if e.orders.is_empty():
		e.has_move_goal = false
		e.active_job = {}
		# Idle builders range further afield looking for work - usually a
		# factory to assist, which is where spare metal is best spent.
		if build_power > 0.0 and not bool(e.def.get("factory", false)):
			auto_assist(world, e, true, 900.0)
		return

	var order: Dictionary = e.orders[0]
	match String(order.get("type", "")):
		MOVE: _do_move(world, e, order)
		ATTACK_MOVE: _do_attack_move(world, e, order)
		ATTACK: _do_attack(world, e, order)
		BUILD: _do_build(world, e, order)
		REPAIR: _do_repair(world, e, order)
		RECLAIM: _do_reclaim(world, e, order)
		GUARD: _do_guard(world, e, order)
		PATROL: _do_patrol(world, e, order)
		_: e.orders.remove_at(0)


static func _finish(e: IdEntity) -> void:
	if not e.orders.is_empty():
		e.orders.remove_at(0)
	e.has_move_goal = false
	e.path = []
	e.active_job = {}


static func _goal(e: IdEntity, x: float, y: float, slack: float = 0.0) -> void:
	e.has_move_goal = true
	e.move_goal = Vector2(x, y)
	e.move_slack = slack


static func _arrive_radius(e: IdEntity) -> float:
	return maxf(ARRIVE_SLACK, e.radius * 1.6)


# ------------------------------------------------------------------- moving

static func _do_move(world: IdWorld, e: IdEntity, order: Dictionary) -> void:
	if float(e.def.get("speed", 0.0)) <= 0.0:
		return _finish(e)
	var ox: float = order["x"]
	var oy: float = order["y"]
	var d: float = IdMath.dist(e.x, e.y, ox, oy)
	var slack: float = float(order.get("slack", 0.0))
	if slack <= 0.0:
		slack = _arrive_radius(e)
	if d <= slack:
		return _finish(e)
	# A crowded destination is still a destination: if we have been jammed for
	# a while and we are nearly there, call it arrived rather than shoving
	# forever. Without this, rally points deadlock as the group grows.
	if e.stuck_timer > 1.0 and d < slack * 5.0:
		return _finish(e)
	_goal(e, ox, oy, float(order.get("slack", 0.0)))
	e.target_id = 0


static func _do_attack_move(world: IdWorld, e: IdEntity, order: Dictionary) -> void:
	var range_max: float = float(e.def.get("maxWeaponRange", 0.0))
	# Stop and engage anything in weapons range, otherwise keep walking.
	var foe: IdEntity = find_nearby_enemy(world, e, range_max * 1.15 + 60.0)
	if foe != null:
		e.target_id = foe.id
		if IdMath.dist(e.x, e.y, foe.x, foe.y) > range_max * 0.85:
			_goal(e, foe.x, foe.y)
		else:
			e.has_move_goal = false
		return
	e.target_id = 0
	var d: float = IdMath.dist(e.x, e.y, order["x"], order["y"])
	var slack: float = _arrive_radius(e)
	if d <= slack:
		return _finish(e)
	if e.stuck_timer > 1.0 and d < slack * 5.0:
		return _finish(e)
	_goal(e, order["x"], order["y"])


static func _do_attack(world: IdWorld, e: IdEntity, order: Dictionary) -> void:
	var target: IdEntity = world.get_entity(int(order.get("targetId", 0)))
	if target == null:
		return _finish(e)
	e.target_id = target.id
	var range_max: float = float(e.def.get("maxWeaponRange", 0.0))
	if range_max <= 0.0:
		# Unarmed units told to attack simply move to the target.
		_goal(e, target.x, target.y)
		if IdMath.dist(e.x, e.y, target.x, target.y) < 60.0:
			_finish(e)
		return
	var d: float = IdMath.dist(e.x, e.y, target.x, target.y) - target.radius
	if d > range_max * 0.9:
		_goal(e, target.x, target.y)
	else:
		e.has_move_goal = false


# ---------------------------------------------------------------- building

static func _do_build(world: IdWorld, e: IdEntity, order: Dictionary) -> void:
	var build_range: float = float(e.def.get("buildRange", 100.0))
	var build_power: float = float(e.def.get("buildPower", 0.0))

	# Phase 1: no nanoframe yet. Walk into range, then place it.
	if int(order.get("targetId", 0)) == 0:
		var d0: float = IdMath.dist(e.x, e.y, order["x"], order["y"])
		if d0 > build_range * 0.85:
			_goal(e, order["x"], order["y"], build_range * 0.8)
			return
		e.has_move_goal = false

		var def: Dictionary = IdUnitDefs.get_def(
			order["defId"], world.players[e.player].faction
		)
		if not can_build_here(world, e.player, def, int(order["cx"]), int(order["cy"])):
			return _finish(e)  # site went bad while we walked over
		var placed: IdEntity = world.spawn(
			order["defId"], e.player, order["x"], order["y"], {"complete": false}
		)
		order["targetId"] = placed.id
		_nudge_units_out(world, placed)
		world.add_effect({
			"type": "buildStart", "x": placed.x, "y": placed.y,
			"size": float(placed.def.get("footprintPx", placed.radius * 2.0)),
		})

	# Phase 2: nanolathe it.
	var site: IdEntity = world.get_entity(int(order.get("targetId", 0)))
	if site == null:
		return _finish(e)
	if not site.under_construction:
		# Finished. Keep repairing if it got shot up during construction.
		if site.hp < site.max_hp * 0.999:
			world.build_jobs.append({
				"builder": e, "kind": "repair", "target": site, "power": build_power,
			})
			e.has_move_goal = false
			return
		return _finish(e)

	var d: float = IdMath.dist(e.x, e.y, site.x, site.y) - site.radius
	if d > build_range:
		_goal(e, site.x, site.y, build_range * 0.75)
		return
	e.has_move_goal = false
	e.active_job = {"kind": "build", "targetId": site.id}
	world.build_jobs.append({
		"builder": e, "kind": "build", "target": site, "power": build_power,
	})


static func _do_repair(world: IdWorld, e: IdEntity, order: Dictionary) -> void:
	var target: IdEntity = world.get_entity(int(order.get("targetId", 0)))
	if target == null or (target.hp >= target.max_hp and not target.under_construction):
		return _finish(e)
	var build_range: float = float(e.def.get("buildRange", 100.0))
	var d: float = IdMath.dist(e.x, e.y, target.x, target.y) - target.radius
	if d > build_range:
		_goal(e, target.x, target.y, build_range * 0.75)
		return
	e.has_move_goal = false
	var kind: String = "build" if target.under_construction else "repair"
	e.active_job = {"kind": kind, "targetId": target.id}
	world.build_jobs.append({
		"builder": e, "kind": kind, "target": target,
		"power": float(e.def.get("buildPower", 0.0)),
	})


static func _find_wreck(world: IdWorld, wreck_id: int) -> Dictionary:
	for w in world.wrecks:
		if int(w["id"]) == wreck_id:
			return w
	return {}


static func _do_reclaim(world: IdWorld, e: IdEntity, order: Dictionary) -> void:
	var wreck: Dictionary = _find_wreck(world, int(order.get("wreckId", 0)))
	if wreck.is_empty() or float(wreck["metal_left"]) <= 0.0:
		return _finish(e)
	var build_range: float = float(e.def.get("buildRange", 100.0))
	var d: float = IdMath.dist(e.x, e.y, wreck["x"], wreck["y"]) - float(wreck["radius"])
	if d > build_range:
		_goal(e, wreck["x"], wreck["y"], build_range * 0.75)
		return
	e.has_move_goal = false
	e.active_job = {"kind": "reclaim", "wreckId": wreck["id"]}
	world.build_jobs.append({
		"builder": e, "kind": "reclaim", "target": wreck,
		"power": float(e.def.get("buildPower", 0.0)),
	})


static func _do_guard(world: IdWorld, e: IdEntity, order: Dictionary) -> void:
	var target: IdEntity = world.get_entity(int(order.get("targetId", 0)))
	if target == null:
		return _finish(e)

	if float(e.def.get("buildPower", 0.0)) > 0.0:
		if _assist_target(world, e, target):
			return

	# Combat escorts shadow the target and engage anything that threatens it.
	var range_max: float = float(e.def.get("maxWeaponRange", 0.0))
	var foe: IdEntity = find_nearby_enemy(world, e, range_max + 180.0)
	if foe != null and range_max > 0.0:
		e.target_id = foe.id
		if IdMath.dist(e.x, e.y, foe.x, foe.y) > range_max * 0.85:
			_goal(e, foe.x, foe.y)
		else:
			e.has_move_goal = false
		return
	e.target_id = 0
	var d: float = IdMath.dist(e.x, e.y, target.x, target.y)
	var keep: float = target.radius + e.radius + 55.0
	if d > keep * 1.6:
		_goal(e, target.x, target.y, keep)
	else:
		e.has_move_goal = false


static func _do_patrol(world: IdWorld, e: IdEntity, order: Dictionary) -> void:
	var points: Array = order.get("points", [])
	if points.is_empty():
		return _finish(e)

	# Fight anything that turns up on the route.
	var range_max: float = float(e.def.get("maxWeaponRange", 0.0))
	if range_max > 0.0:
		var foe: IdEntity = find_nearby_enemy(world, e, range_max * 1.15 + 60.0)
		if foe != null:
			e.target_id = foe.id
			if IdMath.dist(e.x, e.y, foe.x, foe.y) > range_max * 0.85:
				_goal(e, foe.x, foe.y)
			else:
				e.has_move_goal = false
			return
		e.target_id = 0

	# Builders on patrol behave like BAR's: they repair and reclaim as they go.
	if float(e.def.get("buildPower", 0.0)) > 0.0 and auto_assist(world, e, true, 320.0):
		return

	var index: int = int(order.get("index", 0))
	var p: Vector2 = points[index % points.size()]
	if IdMath.dist(e.x, e.y, p.x, p.y) <= _arrive_radius(e) * 1.4:
		index = (index + 1) % points.size()
		order["index"] = index
	var next: Vector2 = points[index % points.size()]
	_goal(e, next.x, next.y)


# --------------------------------------------------------------- assisting

## Contribute build power to whatever `target` is currently doing.
static func _assist_target(world: IdWorld, e: IdEntity, target: IdEntity) -> bool:
	var build_range: float = float(e.def.get("buildRange", 100.0))
	var build_power: float = float(e.def.get("buildPower", 0.0))

	var register := func(kind: String, job_target, tx: float, ty: float, tr: float) -> bool:
		if IdMath.dist(e.x, e.y, tx, ty) - tr > build_range:
			_goal(e, tx, ty, build_range * 0.7)
			return true
		e.has_move_goal = false
		var job_id: int = (
			int(job_target["id"]) if job_target is Dictionary
			else (job_target as IdEntity).id
		)
		e.active_job = {"kind": kind, "targetId": job_id}
		world.build_jobs.append({
			"builder": e, "kind": kind, "target": job_target, "power": build_power,
		})
		return true

	if target.under_construction:
		return register.call("build", target, target.x, target.y, target.radius)

	if bool(target.def.get("factory", false)) and not target.factory_queue.is_empty():
		if IdMath.dist(e.x, e.y, target.x, target.y) - target.radius > build_range:
			_goal(e, target.x, target.y, build_range * 0.7)
			return true
		e.has_move_goal = false
		world.build_jobs.append({
			"builder": e, "kind": "produce", "target": target, "power": build_power,
		})
		return true

	# Follow whatever the guarded builder is working on.
	if not target.active_job.is_empty():
		if target.active_job.has("wreckId"):
			var wreck: Dictionary = _find_wreck(world, int(target.active_job["wreckId"]))
			if not wreck.is_empty() and float(wreck["metal_left"]) > 0.0:
				return register.call(
					"reclaim", wreck, wreck["x"], wreck["y"], float(wreck["radius"])
				)
		else:
			var sub: IdEntity = world.get_entity(int(target.active_job.get("targetId", 0)))
			if sub != null:
				var kind: String = "build" if sub.under_construction else "repair"
				return register.call(kind, sub, sub.x, sub.y, sub.radius)

	if target.hp < target.max_hp * 0.999:
		return register.call("repair", target, target.x, target.y, target.radius)
	return false


## Look for nearby work: unfinished structures first, then busy factories,
## then damaged friendlies, then wrecks worth reclaiming.
static func auto_assist(
	world: IdWorld, e: IdEntity, idle_only: bool = false, radius_override: float = 0.0
) -> bool:
	var build_range: float = float(e.def.get("buildRange", 100.0))
	var build_power: float = float(e.def.get("buildPower", 0.0))
	var assist_only: bool = bool(e.def.get("assistOnly", false))
	var radius: float = radius_override
	if radius <= 0.0:
		radius = build_range if assist_only else build_range * 2.2

	var found: Array = []
	world.grid.query(e.x, e.y, radius, found)
	var team: int = world.players[e.player].team

	var best: IdEntity = null
	var best_score: float = -INF
	for other in found:
		if not other.alive or other == e:
			continue
		if world.players[other.player].team != team:
			continue
		var d: float = IdMath.dist(e.x, e.y, other.x, other.y)
		if d > radius:
			continue
		var score: float = -d
		if other.under_construction:
			score += 5000.0
		elif bool(other.def.get("factory", false)) and not other.factory_queue.is_empty():
			score += 3000.0
		elif other.hp < other.max_hp * 0.98:
			score += 1500.0
		else:
			continue
		if score > best_score:
			best_score = score
			best = other

	if best != null:
		var d: float = IdMath.dist(e.x, e.y, best.x, best.y) - best.radius
		if d > build_range:
			if assist_only:
				return false  # turrets cannot walk over
			_goal(e, best.x, best.y, build_range * 0.7)
			return true
		e.has_move_goal = false
		var kind: String = "repair"
		if best.under_construction:
			kind = "build"
		elif bool(best.def.get("factory", false)) and not best.factory_queue.is_empty():
			kind = "produce"
		world.build_jobs.append({
			"builder": e, "kind": kind, "target": best, "power": build_power,
		})
		return true

	# Nothing to help with: reclaim a wreck within reach.
	if idle_only or assist_only:
		var wreck: Dictionary = {}
		var best_d: float = radius * radius
		for w in world.wrecks:
			if float(w["metal_left"]) <= 0.0:
				continue
			var d2: float = IdMath.dist2(e.x, e.y, w["x"], w["y"])
			if d2 < best_d:
				best_d = d2
				wreck = w
		if not wreck.is_empty():
			var d: float = (
				IdMath.dist(e.x, e.y, wreck["x"], wreck["y"]) - float(wreck["radius"])
			)
			if d > build_range:
				if assist_only:
					return false
				_goal(e, wreck["x"], wreck["y"], build_range * 0.7)
				return true
			e.has_move_goal = false
			world.build_jobs.append({
				"builder": e, "kind": "reclaim", "target": wreck, "power": build_power,
			})
			return true
	return false


# ----------------------------------------------------------------- helpers

static func find_nearby_enemy(world: IdWorld, e: IdEntity, radius: float) -> IdEntity:
	var found: Array = []
	world.grid.query(e.x, e.y, radius, found)
	var fog: IdFogMap = world.fog[e.player]
	var best: IdEntity = null
	var best_score: float = -INF
	for other in found:
		if not other.alive or not world.is_enemy(e, other):
			continue
		var d: float = IdMath.dist(e.x, e.y, other.x, other.y)
		if d > radius:
			continue
		if not fog.is_visible_at(other.x, other.y):
			continue
		# Prefer close, dangerous, and nearly-dead things.
		var score: float = -d
		if float(other.def.get("maxWeaponRange", 0.0)) > 0.0:
			score += 220.0
		if float(other.def.get("buildPower", 0.0)) > 0.0:
			score += 140.0
		if other.under_construction:
			score += 180.0
		score += (1.0 - other.hp / other.max_hp) * 160.0
		if score > best_score:
			best_score = score
			best = other
	return best


## Is this footprint legal for `player_index` to build on right now?
static func can_build_here(
	world: IdWorld, _player_index: int, def: Dictionary, cx: int, cy: int
) -> bool:
	var map: IdGameMap = world.map
	var footprint: int = int(def.get("footprint", 0))
	if not map.can_place(cx, cy, footprint):
		return false
	if bool(def.get("needsMetalSpot", false)):
		var x: float = (cx + footprint / 2.0) * IdGameMap.BUILD_CELL
		var y: float = (cy + footprint / 2.0) * IdGameMap.BUILD_CELL
		var spot: Dictionary = map.metal_spot_near(x, y, IdGameMap.BUILD_CELL * 1.6)
		if spot.is_empty() or bool(spot.get("taken", false)):
			return false
	return true


## Shove any units standing inside a freshly placed footprint out of the way.
static func _nudge_units_out(world: IdWorld, site: IdEntity) -> void:
	var r: float = float(site.def.get("footprintPx", site.radius * 2.0)) * 0.75
	var found: Array = []
	world.grid.query(site.x, site.y, r + 40.0, found)
	for u in found:
		if not u.alive or u.is_building or float(u.def.get("speed", 0.0)) <= 0.0:
			continue
		var dx: float = u.x - site.x
		var dy: float = u.y - site.y
		var d: float = maxf(sqrt(dx * dx + dy * dy), 0.001)
		if d < r + u.radius:
			var push: float = r + u.radius + 4.0 - d
			u.x += (dx / d) * push
			u.y += (dy / d) * push
