class_name IdCombat

## Target acquisition and weapon firing.

const TURRET_TURN_UNIT: float = 7.0  ## radians/second
const TURRET_TURN_BUILDING: float = 3.2
const AIM_TOLERANCE: float = 0.22    ## radians


static func update_combat(world: IdWorld, dt: float) -> void:
	var buf: Array = []

	for e in world.entities:
		if not e.alive or e.under_construction or e.weapons.is_empty():
			continue

		var max_range: float = float(e.def.get("maxWeaponRange", 0.0))
		var target: IdEntity = _resolve_target(world, e, max_range, buf)

		if target == null:
			# Idle turrets drift back to facing forward.
			if e.is_building:
				e.turret_angle = IdMath.turn_towards(
					e.turret_angle, e.heading, TURRET_TURN_BUILDING * dt * 0.3
				)
			for w in e.weapons:
				w.cooldown = maxf(0.0, w.cooldown - dt)
			continue

		e.target_id = target.id

		var turn_rate: float = TURRET_TURN_BUILDING if e.is_building else TURRET_TURN_UNIT
		var to_target: float = atan2(target.y - e.y, target.x - e.x)
		e.turret_angle = IdMath.turn_towards(e.turret_angle, to_target, turn_rate * dt)

		var surface_dist: float = IdMath.dist(e.x, e.y, target.x, target.y) - target.radius

		for w in e.weapons:
			w.cooldown -= dt
			if w.cooldown > 0.0:
				continue
			if surface_dist > float(w.def["range"]):
				continue

			var lead: Vector2 = IdMath.intercept_point(
				e.x, e.y, target.x, target.y, target.vx, target.vy,
				float(w.def["speed"])
			)
			var aim_angle: float = atan2(lead.y - e.y, lead.x - e.x)
			if absf(IdMath.angle_delta(e.turret_angle, aim_angle)) > AIM_TOLERANCE:
				continue

			IdProjectiles.spawn_projectile(world, e, w, target, lead.x, lead.y)
			w.cooldown = float(w.def["reload"])
			w.last_fire = world.time
			w.target_id = target.id
			# Stagger multi-weapon units so both barrels do not fire on the
			# same frame.
			break


static func _resolve_target(
	world: IdWorld, e: IdEntity, max_range: float, buf: Array
) -> IdEntity:
	# Hold on to an explicitly ordered target even outside vision.
	if not e.orders.is_empty() and e.orders[0].get("type", "") == "attack":
		var ordered: IdEntity = world.get_entity(int(e.orders[0].get("targetId", 0)))
		if ordered != null and world.is_enemy(e, ordered):
			var od: float = IdMath.dist(e.x, e.y, ordered.x, ordered.y) - ordered.radius
			if od <= max_range * 1.05:
				return ordered
			return null  # still walking into range

	var current: IdEntity = world.get_entity(e.target_id)
	if current != null and world.is_enemy(e, current):
		var cd: float = IdMath.dist(e.x, e.y, current.x, current.y) - current.radius
		if cd <= max_range and world.fog[e.player].is_visible_at(current.x, current.y):
			return current

	if not IdOrders.take_scan_turn(world, e):
		return null
	return _acquire(world, e, max_range, buf)


static func _acquire(world: IdWorld, e: IdEntity, max_range: float, buf: Array) -> IdEntity:
	world.grid.query(e.x, e.y, max_range + 40.0, buf)
	var fog: IdFogMap = world.fog[e.player]
	var best: IdEntity = null
	var best_score: float = -INF

	for o in buf:
		if not o.alive or not world.is_enemy(e, o):
			continue
		var d: float = IdMath.dist(e.x, e.y, o.x, o.y) - o.radius
		if d > max_range:
			continue
		if not fog.is_visible_at(o.x, o.y):
			continue

		# Shoot the thing that matters most: threats first, then builders,
		# then whatever is closest to dying.
		var score: float = 1000.0 - d
		if float(o.def.get("maxWeaponRange", 0.0)) > 0.0:
			score += 400.0
		if float(o.def.get("buildPower", 0.0)) > 0.0:
			score += 260.0
		if o.under_construction:
			score += 220.0
		if o.id == e.last_attacker_id:
			score += 350.0
		score += (1.0 - o.hp / o.max_hp) * 200.0
		if o.is_building and (o.def.get("weapons", []) as Array).is_empty():
			score -= 300.0  # prefer live targets

		if score > best_score:
			best_score = score
			best = o
	return best
