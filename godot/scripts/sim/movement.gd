class_name IdMovement

## Movement: path following, steering, unit separation and terrain collision.
## Units push each other apart rather than colliding hard, which keeps large
## groups from deadlocking in corridors.
##
## Aircraft take a different path through all of this. They do not ask the
## pathfinder for a route, because there is nothing to route around; they do
## not collide with terrain or with buildings; and they separate only from
## other aircraft. What they have instead is a turn circle: an aircraft that
## overshoots its target has to come round again, which is most of what makes
## flying units feel like flying units rather than fast ground ones.

const REPATH_DISTANCE: float = 140.0  ## goal moved this far -> ask for a new path
const STUCK_SPEED: float = 6.0        ## world units/second considered "not moving"
const STUCK_LIMIT: float = 1.1        ## seconds before we try to recover


static func update_movement(world: IdWorld, dt: float) -> void:
	var neighbours: Array = []

	for e in world.entities:
		if not e.alive or e.is_building or e.under_construction:
			continue
		if float(e.def.get("speed", 0.0)) <= 0.0:
			continue
		if String(e.def.get("layer", "ground")) == "air":
			_update_aircraft(world, e, dt, neighbours)
			continue

		if e.has_move_goal and not (
			is_finite(e.move_goal.x) and is_finite(e.move_goal.y)
		):
			e.has_move_goal = false
			e.orders.clear()

		if not e.has_move_goal:
			_decelerate(e, dt)
			e.path = []
			_integrate(world, e, dt)
			continue

		var goal: Vector2 = e.move_goal
		var slack: float = e.move_slack if e.move_slack > 0.0 else maxf(22.0, e.radius * 1.5)
		if IdMath.dist2(e.x, e.y, goal.x, goal.y) <= slack * slack:
			e.path = []
			_decelerate(e, dt)
			_integrate(world, e, dt)
			continue

		_ensure_path(world, e, goal)

		# Aim at the current waypoint, or straight at the goal while we wait
		# for the pathfinder to get to our request.
		var aim: Vector2 = goal
		if e.path_index < e.path.size():
			var wp: Vector2 = e.path[e.path_index]
			var wp_slack: float = (
				slack if e.path_index == e.path.size() - 1
				else maxf(18.0, e.radius * 1.2)
			)
			if IdMath.dist2(e.x, e.y, wp.x, wp.y) <= wp_slack * wp_slack:
				e.path_index += 1
				if e.path_index >= e.path.size():
					e.path = []
			if e.path_index < e.path.size():
				aim = e.path[e.path_index]

		_steer(e, aim.x, aim.y, dt)
		_separate(world, e, neighbours, dt)
		_integrate(world, e, dt)
		_check_stuck(world, e, dt)


## Fly towards the goal, banking rather than pivoting.
##
## An aircraft always moves at its cruise speed - it cannot stop in the air - so
## "arriving" means circling, and a target behind it means a turn. The rest of
## the movement code would have it stop dead over its destination, which reads
## as a hovering brick.
static func _update_aircraft(world: IdWorld, e: IdEntity, dt: float, buf: Array) -> void:
	if e.has_move_goal and not (
		is_finite(e.move_goal.x) and is_finite(e.move_goal.y)
	):
		e.has_move_goal = false
		e.orders.clear()

	var orbit: float = float(e.def.get("orbit", 120.0))
	var aim: Vector2
	if e.has_move_goal:
		aim = e.move_goal
		var slack: float = e.move_slack if e.move_slack > 0.0 else orbit
		if IdMath.dist2(e.x, e.y, aim.x, aim.y) < slack * slack:
			# Inside the circle: aim at a point around the rim so it keeps flying.
			e.orbit_phase += dt * 1.4
			aim += Vector2(cos(e.orbit_phase), sin(e.orbit_phase)) * slack
		e.has_hold = false
	else:
		# Nowhere to be: orbit where it is rather than hanging still.
		if not e.has_hold:
			e.hold = Vector2(e.x, e.y)
			e.has_hold = true
		e.orbit_phase += dt * 1.1
		aim = e.hold + Vector2(cos(e.orbit_phase), sin(e.orbit_phase)) * orbit

	var desired: float = atan2(aim.y - e.y, aim.x - e.x)
	e.heading = IdMath.turn_towards(e.heading, desired, float(e.def["turnRate"]) * dt)
	var speed: float = float(e.def["speed"])
	e.vx = cos(e.heading) * speed
	e.vy = sin(e.heading) * speed
	e.speed = speed
	e.x += e.vx * dt
	e.y += e.vy * dt

	# Bank angle, for the renderer to roll the model into its turn.
	var turn: float = IdMath.angle_delta(e.heading, desired)
	var want_bank: float = clampf(turn * 2.2, -0.7, 0.7)
	e.bank = clampf(e.bank + (want_bank - e.bank) * minf(1.0, dt * 4.0), -0.7, 0.7)

	# Climb to cruise height, and keep clear of other aircraft at that height.
	var cruise: float = float(e.def.get("altitude", 90.0))
	e.altitude += (cruise - e.altitude) * minf(1.0, dt * 1.5)
	_separate_air(world, e, buf, dt)

	e.x = clampf(e.x, 8.0, world.map.width - 8.0)
	e.y = clampf(e.y, 8.0, world.map.height - 8.0)
	e.last_x = e.x
	e.last_y = e.y
	e.stuck_timer = 0.0


## Aircraft push apart from each other only; the ground is not in their way.
static func _separate_air(world: IdWorld, e: IdEntity, buf: Array, dt: float) -> void:
	var reach: float = e.radius * 3.2 + 20.0
	world.grid.query(e.x, e.y, reach, buf)
	var px: float = 0.0
	var py: float = 0.0
	for i in range(buf.size()):
		var o: IdEntity = buf[i]
		if o == e or not o.alive or String(o.def.get("layer", "ground")) != "air":
			continue
		var dx: float = e.x - o.x
		var dy: float = e.y - o.y
		var min_dist: float = e.radius + o.radius + 12.0
		var d2: float = dx * dx + dy * dy
		if d2 >= min_dist * min_dist or d2 < 1e-9:
			continue
		var d: float = sqrt(d2)
		px += (dx / d) * (min_dist - d) / min_dist
		py += (dy / d) * (min_dist - d) / min_dist
	if px != 0.0 or py != 0.0:
		var push: float = float(e.def["speed"]) * dt * 0.6
		e.x += px * push
		e.y += py * push


static func _ensure_path(world: IdWorld, e: IdEntity, goal: Vector2) -> void:
	var needs_path: bool = (
		e.path.is_empty()
		or not e.has_path_goal
		or IdMath.dist2(e.path_goal.x, e.path_goal.y, goal.x, goal.y)
			> REPATH_DISTANCE * REPATH_DISTANCE
	)
	if not needs_path or e.path_pending:
		return

	e.path_pending = true
	e.has_path_goal = true
	e.path_goal = goal
	var gx: float = goal.x
	var gy: float = goal.y
	var priority: int = 2 if String(e.def.get("role", "")) == "builder" else 1

	var on_path := func(path: Array) -> void:
		e.path_pending = false
		if not e.alive:
			return
		# A newer goal may have been issued while the request was queued.
		if not e.has_path_goal or IdMath.dist2(e.path_goal.x, e.path_goal.y, gx, gy) > 1.0:
			return
		e.path = path
		e.path_index = 0
		if path.is_empty():
			# Unreachable: stop trying so the unit does not grind against a
			# wall.
			e.has_move_goal = false
			e.has_path_goal = false
			if not e.orders.is_empty():
				e.orders.remove_at(0)

	world.pathfinder.request(e.x, e.y, gx, gy, on_path, priority, bool(e.def.get("isInfantry", false)))


static func _steer(e: IdEntity, aim_x: float, aim_y: float, dt: float) -> void:
	var dx: float = aim_x - e.x
	var dy: float = aim_y - e.y
	var d: float = maxf(sqrt(dx * dx + dy * dy), 1e-6)
	var desired: float = atan2(dy, dx)

	e.heading = IdMath.turn_towards(e.heading, desired, float(e.def["turnRate"]) * dt)

	# Slow down while turning hard, and while arriving.
	var facing: float = cos(e.heading - desired)
	var turn_penalty: float = clampf(facing, 0.15, 1.0)
	var arrival: float = clampf(d / 60.0, 0.25, 1.0)
	var target_speed: float = float(e.def["speed"]) * e.speed_scale * turn_penalty * arrival

	var tvx: float = cos(e.heading) * target_speed
	var tvy: float = sin(e.heading) * target_speed
	var accel: float = float(e.def["accel"]) * dt
	e.vx += clampf(tvx - e.vx, -accel, accel)
	e.vy += clampf(tvy - e.vy, -accel, accel)


static func _decelerate(e: IdEntity, dt: float) -> void:
	var decel: float = float(e.def.get("accel", 0.0)) * 2.0 * dt
	var sp: float = sqrt(e.vx * e.vx + e.vy * e.vy)
	if sp <= decel:
		e.vx = 0.0
		e.vy = 0.0
	else:
		e.vx -= (e.vx / sp) * decel
		e.vy -= (e.vy / sp) * decel


## Push overlapping units apart, weighted by mass.
static func _separate(world: IdWorld, e: IdEntity, buf: Array, dt: float) -> void:
	var reach: float = e.radius * 2.6 + 18.0
	world.grid.query(e.x, e.y, reach, buf)
	var px: float = 0.0
	var py: float = 0.0
	var my_mass: float = float(e.def.get("mass", 1.0))
	for i in range(buf.size()):
		var o: IdEntity = buf[i]
		if o == e or not o.alive or o.is_building:
			continue
		var dx: float = e.x - o.x
		var dy: float = e.y - o.y
		var min_dist: float = e.radius + o.radius
		var d2: float = dx * dx + dy * dy
		if d2 >= min_dist * min_dist or d2 < 1e-9:
			continue
		var d: float = sqrt(d2)
		var overlap: float = (min_dist - d) / min_dist
		var other_mass: float = float(o.def.get("mass", 1.0))
		var mass_ratio: float = other_mass / (my_mass + other_mass)
		px += (dx / d) * overlap * mass_ratio
		py += (dy / d) * overlap * mass_ratio
	if px != 0.0 or py != 0.0:
		var push: float = float(e.def["speed"]) * 2.2
		e.vx += px * push * dt * 30.0 * 0.6
		e.vy += py * push * dt * 30.0 * 0.6


## Integrate velocity with terrain collision, sliding along blocked edges.
static func _integrate(world: IdWorld, e: IdEntity, dt: float) -> void:
	var speed: float = sqrt(e.vx * e.vx + e.vy * e.vy)
	var max_speed: float = float(e.def["speed"]) * e.speed_scale * 1.35
	if speed > max_speed:
		e.vx = (e.vx / speed) * max_speed
		e.vy = (e.vy / speed) * max_speed
	e.speed = minf(speed, max_speed)
	if e.speed < 0.001:
		return

	var map: IdGameMap = world.map
	var nx: float = e.x + e.vx * dt
	var ny: float = e.y + e.vy * dt

	# Infantry are allowed onto rock; everything else is stopped by it. The
	# pathfinder already routed them differently, but the step test has to agree
	# or a squad would path onto a ridge and then be shoved back off it.
	var on_foot: bool = bool(e.def.get("isInfantry", false))

	if map.is_passable_for(nx, ny, on_foot):
		e.x = nx
		e.y = ny
		return
	# Blocked head-on: try each axis so units slide along walls instead of
	# sticking to them.
	if map.is_passable_for(nx, e.y, on_foot):
		e.x = nx
		e.vy *= 0.4
	elif map.is_passable_for(e.x, ny, on_foot):
		e.y = ny
		e.vx *= 0.4
	else:
		e.vx *= 0.25
		e.vy *= 0.25
	e.x = clampf(e.x, 8.0, map.width - 8.0)
	e.y = clampf(e.y, 8.0, map.height - 8.0)


static func _check_stuck(world: IdWorld, e: IdEntity, dt: float) -> void:
	var moved: float = IdMath.dist(e.x, e.y, e.last_x, e.last_y) / dt
	e.last_x = e.x
	e.last_y = e.y

	if moved >= STUCK_SPEED:
		e.stuck_timer = 0.0
		return
	e.stuck_timer += dt

	if e.stuck_timer > STUCK_LIMIT:
		e.stuck_timer = 0.0
		e.path = []
		e.has_path_goal = false
		# Shuffle sideways to break symmetric jams, then repath next tick.
		var side: float = 1.0 if world.rng.next() < 0.5 else -1.0
		var a: float = e.heading + side * (PI * 0.5)
		e.vx += cos(a) * float(e.def["speed"]) * 0.9
		e.vy += sin(a) * float(e.def["speed"]) * 0.9
