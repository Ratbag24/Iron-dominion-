class_name IdProjectiles

## Projectile flight and impact.
##
## Lasers travel fast in a straight line, missiles home, and plasma/artillery
## shells arc to a predicted impact point and detonate with splash damage.


static func spawn_projectile(
	world: IdWorld, shooter: IdEntity, weapon: IdWeapon, target: IdEntity,
	aim_x: float, aim_y: float
) -> Dictionary:
	var w: Dictionary = weapon.def
	var kind: String = w.get("kind", "laser")
	var spread: float = float(w.get("spread", 0.0))
	var speed: float = float(w["speed"])
	var base_angle: float = atan2(aim_y - shooter.y, aim_x - shooter.x)
	var angle: float = base_angle + (world.rng.next() - 0.5) * 2.0 * spread
	var flight_dist: float = IdMath.dist(shooter.x, shooter.y, aim_x, aim_y)

	var px: float = shooter.x + cos(shooter.turret_angle) * (shooter.radius * 0.9)
	var py: float = shooter.y + sin(shooter.turret_angle) * (shooter.radius * 0.9)

	var p: Dictionary = {
		"kind": kind,
		"x": px, "y": py,
		"px": px, "py": py,
		"vx": cos(angle) * speed,
		"vy": sin(angle) * speed,
		"speed": speed,
		"damage": float(w["damage"]),
		"aoe": float(w.get("aoe", 0.0)),
		"color": w.get("color", "#ffffff"),
		"player": shooter.player,
		"owner_id": shooter.id,
		"target_id": target.id if target != null else 0,
		# Carried from the weapon so the killing blow knows whether it takes
		# what it kills; the shooter alone cannot say, since a unit may hold
		# more than one weapon.
		"infects": float(w.get("infects", 0.0)),
		# What the shell is allowed to hit, so a ground-only splash cannot rake
		# aircraft out of the sky by accident.
		"targets": String(w.get("targets", "ground")),
		# Armour multipliers travel with the shell rather than being looked up
		# at impact: one splash can land on several armour classes at once, so
		# the scaling has to happen per target, not per shot.
		"vs": w.get("vs", {}),
		"life": clampf((float(w["range"]) * 1.6) / speed, 0.25, 6.0),
		"z": 0.0,
		"trail": 22.0 if kind == "laser" else 0.0,
	}

	if kind == "arty" or kind == "plasma":
		# Lock in the impact point and arc toward it.
		p["tx"] = aim_x + (world.rng.next() - 0.5) * 2.0 * spread * flight_dist
		p["ty"] = aim_y + (world.rng.next() - 0.5) * 2.0 * spread * flight_dist
		var d: float = IdMath.dist(p["x"], p["y"], p["tx"], p["ty"])
		p["flight_time"] = maxf(0.05, d / speed)
		p["elapsed"] = 0.0
		p["sx"] = p["x"]
		p["sy"] = p["y"]
		p["arc"] = d * 0.30 if kind == "arty" else d * 0.12
		p["life"] = float(p["flight_time"]) + 0.05

	world.projectiles.append(p)
	world.add_effect({
		"type": "muzzle", "x": p["x"], "y": p["y"], "angle": angle,
		"color": p["color"], "size": minf(26.0, 6.0 + float(w["damage"]) * 0.05),
		# Who fired, so the view can kick the gun back.
		"owner": shooter.id,
	})
	return p


static func update_projectiles(world: IdWorld, dt: float) -> void:
	var list: Array[Dictionary] = world.projectiles
	var buf: Array = []

	for i in range(list.size() - 1, -1, -1):
		var p: Dictionary = list[i]
		p["life"] = float(p["life"]) - dt
		var kind: String = p["kind"]

		if kind == "arty" or kind == "plasma":
			p["elapsed"] = float(p["elapsed"]) + dt
			var t: float = clampf(float(p["elapsed"]) / float(p["flight_time"]), 0.0, 1.0)
			p["px"] = p["x"]
			p["py"] = p["y"]
			p["x"] = float(p["sx"]) + (float(p["tx"]) - float(p["sx"])) * t
			p["y"] = float(p["sy"]) + (float(p["ty"]) - float(p["sy"])) * t
			p["z"] = sin(t * PI) * float(p["arc"])
			if t >= 1.0:
				_detonate(world, p, buf, null)
				list.remove_at(i)
				continue
			# Shells low to the ground can still clip a unit on the way in.
			if float(p["z"]) < 18.0 and _hit_check(world, p, buf):
				list.remove_at(i)
			continue

		if kind == "missile":
			var target: IdEntity = world.get_entity(int(p["target_id"]))
			if target != null:
				var desired: float = atan2(target.y - float(p["y"]), target.x - float(p["x"]))
				var current: float = atan2(float(p["vy"]), float(p["vx"]))
				var a: float = IdMath.turn_towards(current, desired, 4.5 * dt)
				p["vx"] = cos(a) * float(p["speed"])
				p["vy"] = sin(a) * float(p["speed"])

		p["px"] = p["x"]
		p["py"] = p["y"]
		p["x"] = float(p["x"]) + float(p["vx"]) * dt
		p["y"] = float(p["y"]) + float(p["vy"]) * dt

		if _hit_check(world, p, buf):
			list.remove_at(i)
			continue

		var cell: int = world.map.cell
		var in_bounds: bool = world.map.in_bounds(
			int(float(p["x"]) / cell), int(float(p["y"]) / cell)
		)
		if float(p["life"]) <= 0.0 or not in_bounds:
			if float(p["aoe"]) > 0.0:
				_detonate(world, p, buf, null)
			list.remove_at(i)


static func _hit_check(world: IdWorld, p: Dictionary, buf: Array) -> bool:
	var reach: float = 26.0 + float(p["speed"]) * 0.02
	world.grid.query(p["x"], p["y"], reach, buf)
	var my_team: int = world.players[p["player"]].team
	for e in buf:
		if not e.alive or e.id == int(p["owner_id"]):
			continue
		if world.players[e.player].team == my_team:
			continue
		if not _reaches(p, e):
			continue
		var r: float = e.radius + 3.0
		# Segment check so fast projectiles cannot tunnel through small units.
		if _segment_hits_circle(
			p["px"], p["py"], p["x"], p["y"], e.x, e.y, r
		):
			_detonate(world, p, buf, e)
			return true
	return false


## Whether this projectile is allowed to touch that entity's layer.
static func _reaches(p: Dictionary, e: IdEntity) -> bool:
	var targets: String = String(p.get("targets", "ground"))
	if targets == "both":
		return true
	var flying: bool = String(e.def.get("layer", "ground")) == "air"
	return flying if targets == "air" else not flying


static func _segment_hits_circle(
	x0: float, y0: float, x1: float, y1: float, cx: float, cy: float, r: float
) -> bool:
	var dx: float = x1 - x0
	var dy: float = y1 - y0
	var len2: float = dx * dx + dy * dy
	var t: float = ((cx - x0) * dx + (cy - y0) * dy) / len2 if len2 > 1e-9 else 0.0
	t = clampf(t, 0.0, 1.0)
	var ddx: float = cx - (x0 + dx * t)
	var ddy: float = cy - (y0 + dy * t)
	return ddx * ddx + ddy * ddy <= r * r


## How much of this shell's damage the target's armour actually takes.
static func _scale_for(p: Dictionary, target: IdEntity) -> float:
	var vs: Dictionary = p.get("vs", {})
	if vs.is_empty():
		return 1.0
	var armour := String(target.def.get("armour", IdUnitDefs.ARMOUR_STANDARD))
	if armour == IdUnitDefs.ARMOUR_STANDARD:
		return 1.0
	return float(vs.get(armour, 1.0))


static func _detonate(
	world: IdWorld, p: Dictionary, buf: Array, direct_hit: IdEntity
) -> void:
	var shooter: IdEntity = world.get_entity(int(p["owner_id"]))
	var damage: float = float(p["damage"])

	if direct_hit != null:
		world.damage(
			direct_hit, damage * _scale_for(p, direct_hit), shooter,
			float(p.get("infects", 0.0))
		)

	var aoe: float = float(p["aoe"])
	if aoe > 0.0:
		world.grid.query(p["x"], p["y"], aoe, buf)
		var my_team: int = world.players[p["player"]].team
		for e in buf:
			if not e.alive or e == direct_hit:
				continue
			if world.players[e.player].team == my_team:
				continue
			if not _reaches(p, e):
				continue
			var d: float = IdMath.dist(p["x"], p["y"], e.x, e.y) - e.radius
			if d > aoe:
				continue
			var falloff: float = 1.0 - clampf(d / aoe, 0.0, 1.0)
			# Splash does not convert: a shell that took a whole group would
			# make the hive's artillery the only weapon worth building.
			world.damage(e, damage * falloff * 0.85 * _scale_for(p, e), shooter)
		world.add_effect({
			"type": "explosion", "x": p["x"], "y": p["y"],
			"size": aoe * 1.15, "color": p["color"],
		})
	else:
		world.add_effect({
			"type": "impact", "x": p["x"], "y": p["y"],
			"color": p["color"], "size": 8.0,
		})
