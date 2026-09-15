extends SceneTree

## Where the tick's two heaviest phases spend their time, at 400 a side.
##
## bench_scale.gd says orders and movement dominate; this splits each into
## its parts by calling them directly over the same army, so an optimisation
## goes where the time actually is rather than where it feels like it is.

func _init() -> void:
	var world := IdWorld.new({
		"seed": 777,
		"players": [{"name": "A", "faction": "vanguard"}, {"name": "B", "faction": "legion"}],
	})
	for side in range(2):
		var p: IdPlayer = world.players[side]
		var roster: Dictionary = IdUnitDefs.roster(p.faction)
		var sign := 1.0 if side == 0 else -1.0
		for i in range(400):
			world.spawn(roster["assault"], side,
				world.map.width * 0.5 + sign * (260.0 + (i / 28) * 30.0),
				world.map.height * 0.5 + ((i % 28) - 14.0) * 30.0, {"complete": true})
		for e in world.units_of(side):
			e.orders.append({"type": IdOrders.ATTACK_MOVE,
				"x": world.map.width * 0.5 - sign * 400.0, "y": world.map.height * 0.5})
	for i in range(IdWorld.SIM_HZ * 6):
		world.tick()

	var units: Array = []
	for e in world.entities:
		if e.alive and not e.is_building:
			units.append(e)
	print("units: %d" % units.size())
	var dt: float = IdWorld.SIM_DT
	var reps := 30

	# Movement parts.
	var buf: Array = []
	_time("movement: separate", reps, func():
		for e in units: IdMovement._separate(world, e, buf, dt))
	_time("movement: steer", reps, func():
		for e in units: IdMovement._steer(e, e.x + 10.0, e.y, dt))
	_time("movement: integrate", reps, func():
		for e in units: IdMovement._integrate(world, e, dt))
	_time("movement: check_stuck", reps, func():
		for e in units: IdMovement._check_stuck(world, e, dt))
	_time("movement: ensure_path", reps, func():
		for e in units:
			if e.has_move_goal: IdMovement._ensure_path(world, e, e.move_goal))
	_time("movement: whole", reps, func(): IdMovement.update_movement(world, dt))

	# Orders parts.
	_time("orders: current_foe", reps, func():
		for e in units: IdOrders.current_foe(world, e, 300.0))
	_time("orders: find_nearby_enemy (forced)", reps, func():
		for e in units: IdOrders.find_nearby_enemy(world, e, 300.0))
	_time("orders: grid.query only", reps, func():
		for e in units: world.grid.query(e.x, e.y, 300.0, buf))
	_time("orders: whole", reps, func():
		world.build_jobs.clear()
		for e in world.entities:
			if e.alive: IdOrders.update_orders(world, e, dt))
	_time("def.get x4 per unit", reps, func():
		for e in units:
			var a = float(e.def.get("speed", 0.0)); var b = float(e.def.get("mass", 1.0))
			var c = String(e.def.get("layer", "ground")); var d = float(e.def.get("maxWeaponRange", 0.0)))
	world.dispose()
	quit()


func _time(label: String, reps: int, fn: Callable) -> void:
	var t0 := Time.get_ticks_usec()
	for i in reps:
		fn.call()
	print("  %-36s %6.2f ms" % [label, float(Time.get_ticks_usec() - t0) / 1000.0 / float(reps)])
