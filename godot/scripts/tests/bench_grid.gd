extends SceneTree

## What the spatial grid's cell size costs.
##
## Separation asks for everything within about fifty units; target acquisition
## asks for everything within three hundred. One cell size has to serve both,
## and the two want opposite things: small cells keep the close query tight,
## large cells keep the wide one from sweeping hundreds of mostly empty cells.
##
## The answer, measured at 400 units in a melee, is that it barely matters:
##
##   cell  48: 55.6 ms/tick   movement 16.8, orders 12.3, combat 7.3
##   cell  64: 53.4 ms/tick   movement 15.4, orders 12.9, combat 6.4
##   cell  96: 54.4 ms/tick   movement 17.8, orders 11.1, combat 6.5
##   cell 128: 56.7 ms/tick   movement 17.9, orders 12.6, combat 6.4
##
## Everything from 48 to 128 lands inside the run-to-run noise, so the cost of
## movement is not the breadth of its query and there is nothing to win by
## tuning this. Kept so the next person does not have to find that out again.

func _init() -> void:
	for cell in [48, 64, 96, 128]:
		_measure(cell, 200)
	quit()


func _measure(cell: int, per_side: int) -> void:
	var world := IdWorld.new({
		"seed": 777,
		"players": [
			{"name": "A", "faction": "vanguard"},
			{"name": "B", "faction": "legion"},
		],
	})
	world.grid = IdSpatialGrid.new(world.map.width, world.map.height, cell)

	for side in range(2):
		var p: IdPlayer = world.players[side]
		var roster: Dictionary = IdUnitDefs.roster(p.faction)
		var sign := 1.0 if side == 0 else -1.0
		var per_row := 28
		for i in range(per_side):
			world.spawn(
				roster["assault"], side,
				world.map.width * 0.5 + sign * (260.0 + (i / per_row) * 30.0),
				world.map.height * 0.5 + ((i % per_row) - per_row * 0.5) * 30.0,
				{"complete": true}
			)
		for e in world.units_of(side):
			e.orders.append({
				"type": IdOrders.ATTACK_MOVE,
				"x": world.map.width * 0.5 - sign * 400.0,
				"y": world.map.height * 0.5,
			})

	for i in range(IdWorld.SIM_HZ * 6):
		world.tick()

	var ticks := 90
	world.profile = true
	world.phase_us.clear()
	var t0 := Time.get_ticks_usec()
	for i in range(ticks):
		world.tick()
	var per_tick := float(Time.get_ticks_usec() - t0) / 1000.0 / float(ticks)

	var parts: Array[String] = []
	for name in ["movement", "orders", "combat", "grid"]:
		parts.append("%s %.1f" % [name, float(world.phase_us.get(name, 0)) / 1000.0 / float(ticks)])
	print("cell %3d: %6.2f ms/tick   %s" % [cell, per_tick, ", ".join(parts)])
	world.dispose()
