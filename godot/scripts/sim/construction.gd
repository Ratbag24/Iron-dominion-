class_name IdConstruction

## Nanolathe construction, repair, reclaim and factory production.
##
## Build jobs registered by orders are grouped by target so that several
## builders assisting the same site simply add their build power together —
## the same "everything is build power" model Beyond All Reason uses.

const REPAIR_COST_FRACTION: float = 0.5


## Group this tick's jobs and work out what each player would like to spend.
## Fills world.job_groups and the per-player demand totals.
static func compute_build_demand(world: IdWorld, dt: float) -> Dictionary:
	var groups: Dictionary = {}

	for job in world.build_jobs:
		var kind: String = job["kind"]
		var target = job["target"]
		if target == null:
			continue
		if kind != "reclaim" and not (target as IdEntity).alive:
			continue
		var target_id: int = (
			int(target["id"]) if kind == "reclaim" else (target as IdEntity).id
		)
		var key: String = "%s:%d" % [kind, target_id]
		var g: Dictionary = groups.get(key, {})
		if g.is_empty():
			g = {
				"kind": kind, "target": target, "power": 0.0,
				"player": (job["builder"] as IdEntity).player, "builders": [],
				"delta": 0.0, "delta_hp": 0.0, "metal": 0.0, "energy": 0.0,
			}
			groups[key] = g
		g["power"] += float(job["power"])
		g["builders"].append(job["builder"])

	for p in world.players:
		p.metal_demand = 0.0
		p.energy_demand = 0.0
		p.build_power_used = 0.0

	for key in groups:
		var g: Dictionary = groups[key]
		var player: IdPlayer = world.players[g["player"]]
		player.build_power_used += g["power"]
		var power: float = g["power"]
		var kind: String = g["kind"]

		if kind == "build":
			var target: IdEntity = g["target"]
			var def: Dictionary = target.def
			var delta: float = minf(
				power * dt / float(def["buildTime"]), 1.0 - target.build_progress
			)
			g["delta"] = maxf(0.0, delta)
			g["metal"] = float(def["metal"]) * g["delta"]
			g["energy"] = float(def["energy"]) * g["delta"]
		elif kind == "produce":
			var factory: IdEntity = g["target"]
			if factory.factory_queue.is_empty():
				continue
			var item: Dictionary = factory.factory_queue[0]
			var idef: Dictionary = IdUnitDefs.get_def(
				item["defId"], world.players[factory.player].faction
			)
			g["itemDef"] = idef
			var pdelta: float = minf(
				power * dt / float(idef["buildTime"]), 1.0 - factory.factory_progress
			)
			g["delta"] = maxf(0.0, pdelta)
			g["metal"] = float(idef["metal"]) * g["delta"]
			g["energy"] = float(idef["energy"]) * g["delta"]
		elif kind == "repair":
			var rtarget: IdEntity = g["target"]
			var rdef: Dictionary = rtarget.def
			var hp_per_second: float = power * (float(rdef["hp"]) / float(rdef["buildTime"]))
			var delta_hp: float = minf(hp_per_second * dt, rtarget.max_hp - rtarget.hp)
			g["delta_hp"] = maxf(0.0, delta_hp)
			var fraction: float = (
				g["delta_hp"] / rtarget.max_hp if rtarget.max_hp > 0.0 else 0.0
			)
			g["metal"] = float(rdef["metal"]) * fraction * REPAIR_COST_FRACTION
			g["energy"] = 0.0
		elif kind == "reclaim":
			# Reclaim produces metal instead of consuming it.
			var wreck: Dictionary = g["target"]
			g["metal"] = 0.0
			g["energy"] = 0.0
			g["delta"] = maxf(0.0, minf(
				power * dt / float(wreck["reclaim_time"]),
				1.0 - float(wreck["reclaim_progress"])
			))
			continue

		player.metal_demand += g["metal"]
		player.energy_demand += g["energy"]

	world.job_groups = groups
	return groups


## Spend the resources the economy allowed and advance each job.
static func apply_construction(world: IdWorld, dt: float) -> void:
	var groups: Dictionary = world.job_groups
	if groups.is_empty():
		return

	for key in groups:
		var g: Dictionary = groups[key]
		var player: IdPlayer = world.players[g["player"]]
		var kind: String = g["kind"]

		if kind == "reclaim":
			var wreck: Dictionary = g["target"]
			if float(wreck["metal_left"]) <= 0.0:
				continue
			var gained: float = minf(
				float(wreck["metal"]) * float(g["delta"]), float(wreck["metal_left"])
			)
			wreck["reclaim_progress"] = clampf(
				float(wreck["reclaim_progress"]) + float(g["delta"]), 0.0, 1.0
			)
			wreck["metal_left"] = float(wreck["metal_left"]) - gained
			player.metal = minf(player.metal_storage, player.metal + gained)
			player.metal_reclaim += gained / dt
			player.stats["metal_reclaimed"] += gained
			if world.tick_count % 4 == 0 and gained > 0.0:
				var b0: IdEntity = g["builders"][0]
				world.add_effect({
					"type": "nanolathe", "x": b0.x, "y": b0.y,
					"tx": wreck["x"], "ty": wreck["y"],
					"reclaim": true, "player": g["player"],
				})
			continue

		var ratio: float = minf(player.metal_ratio, player.energy_ratio)
		if ratio <= 0.0:
			continue

		if kind == "build":
			var target: IdEntity = g["target"]
			var delta: float = float(g["delta"]) * ratio
			if delta <= 0.0:
				continue
			target.build_progress = clampf(target.build_progress + delta, 0.0, 1.0)
			target.hp = minf(
				target.max_hp,
				maxf(target.hp, target.max_hp * (0.05 + 0.95 * target.build_progress))
			)
			_spend(player, float(g["metal"]) * ratio, float(g["energy"]) * ratio)
			_emit_lathe(world, g, target.x, target.y)
			if target.build_progress >= 1.0:
				target.under_construction = false
				target.hp = target.max_hp
				target.build_progress = 1.0
				player.stats["built"] += 1
				world.add_effect({
					"type": "buildDone", "x": target.x, "y": target.y,
					"size": float(target.def.get("footprintPx", target.radius * 2.0)),
				})
		elif kind == "produce":
			var factory: IdEntity = g["target"]
			if factory.factory_queue.is_empty():
				continue
			var item: Dictionary = factory.factory_queue[0]
			var pdelta: float = float(g["delta"]) * ratio
			if pdelta <= 0.0:
				continue
			factory.factory_progress = clampf(factory.factory_progress + pdelta, 0.0, 1.0)
			_spend(player, float(g["metal"]) * ratio, float(g["energy"]) * ratio)
			_emit_lathe(world, g, factory.x, factory.y)
			if factory.factory_progress >= 1.0:
				factory.factory_progress = 0.0
				_complete_factory_item(world, factory, item)
		elif kind == "repair":
			var rtarget: IdEntity = g["target"]
			var delta_hp: float = float(g["delta_hp"]) * ratio
			if delta_hp <= 0.0:
				continue
			rtarget.hp = minf(rtarget.max_hp, rtarget.hp + delta_hp)
			_spend(player, float(g["metal"]) * ratio, 0.0)
			_emit_lathe(world, g, rtarget.x, rtarget.y)

	world.job_groups = {}


static func _spend(player: IdPlayer, metal: float, energy: float) -> void:
	player.metal = maxf(0.0, player.metal - metal)
	player.energy = maxf(0.0, player.energy - energy)


static func _emit_lathe(world: IdWorld, g: Dictionary, tx: float, ty: float) -> void:
	if world.tick_count % 3 != 0:
		return
	var builders: Array = g["builders"]
	for i in range(mini(builders.size(), 6)):
		var b: IdEntity = builders[i]
		if b.x == tx and b.y == ty:
			continue
		world.add_effect({
			"type": "nanolathe", "x": b.x, "y": b.y,
			"tx": tx, "ty": ty, "player": g["player"],
		})


## Place one body from a factory order, scattered if it is part of a squad.
static func _spawn_from_factory(
	world: IdWorld, factory: IdEntity, def_id: String, exit_point: Vector2,
	index: int, count: int
) -> IdEntity:
	# A squad is dealt out around the factory door rather than stacked on it,
	# or the separation pass would spend its first second untangling them.
	var ring: float = (9.0 + float(count) * 1.6) if count > 1 else 0.0
	var a: float = ((float(index) / float(count)) * TAU + world.rng.next() * 0.5) if count > 1 else 0.0
	var sx: float = exit_point.x + cos(a) * ring
	var sy: float = exit_point.y + sin(a) * ring
	var unit: IdEntity = world.spawn(def_id, factory.player, sx, sy, {"complete": true})
	unit.heading = factory.heading

	if factory.has_rally:
		# Scatter arrivals so a long production run does not pile into one point.
		var spread: float = 26.0 + sqrt(
			maxf(1.0, float(world.units_of(factory.player).size()))
		) * 9.0
		unit.orders.append({
			"type": "move",
			"x": factory.rally.x + (world.rng.next() - 0.5) * spread,
			"y": factory.rally.y + (world.rng.next() - 0.5) * spread,
		})
	else:
		unit.orders.append({
			"type": "move",
			"x": sx,
			"y": sy + float(factory.def.get("footprintPx", 0.0)) * 0.9,
		})

	world.add_effect({
		"type": "unitDone", "x": unit.x, "y": unit.y, "player": factory.player,
	})
	return unit


## Pop a finished unit out of its factory and send it to the rally point.
static func _complete_factory_item(world: IdWorld, factory: IdEntity, item: Dictionary) -> void:
	var exit_point: Vector2 = _factory_exit(world, factory)
	# Infantry come out as a squad: one order, one cost, one build time, and
	# then `squad` bodies at once. Building them one at a time would make them
	# strictly worse tanks -- the whole point of troops is that they arrive as a
	# number. They are separate entities from the moment they leave the door.
	var def: Dictionary = IdUnitDefs.get_def(
		String(item["defId"]), world.players[factory.player].faction
	)
	var count: int = maxi(1, int(def.get("squad", 1)))
	for i in count:
		_spawn_from_factory(world, factory, String(item["defId"]), exit_point, i, count)

	item["count"] = int(item["count"]) - 1
	if int(item["count"]) <= 0:
		factory.factory_queue.remove_at(0)
		if factory.repeat:
			var orig: int = int(item.get("origCount", 1))
			factory.factory_queue.append({
				"defId": item["defId"], "count": orig, "origCount": orig,
			})


## Find an unobstructed tile just outside the factory to place the new unit.
static func _factory_exit(world: IdWorld, factory: IdEntity) -> Vector2:
	var map: IdGameMap = world.map
	var half: float = float(factory.def.get("footprintPx", 0.0)) * 0.5
	var candidates: Array[Vector2] = [
		Vector2(factory.x, factory.y + half + 24.0),
		Vector2(factory.x + half + 24.0, factory.y),
		Vector2(factory.x - half - 24.0, factory.y),
		Vector2(factory.x, factory.y - half - 24.0),
	]
	for c in candidates:
		if map.is_passable(c.x, c.y):
			return c
	for r in range(1, 8):
		for a in range(12):
			var ang: float = (float(a) / 12.0) * TAU
			var x: float = factory.x + cos(ang) * (half + 24.0 + r * 18.0)
			var y: float = factory.y + sin(ang) * (half + 24.0 + r * 18.0)
			if map.is_passable(x, y):
				return Vector2(x, y)
	return Vector2(factory.x, factory.y + half + 24.0)
