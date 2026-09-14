extends SceneTree

## What the tick costs as an army grows.
##
## A match has a 33ms budget at 30Hz, and that has to cover rendering too. The
## question this answers is how many units fit inside it.

func _init() -> void:
	for count in [50, 100, 200, 400]:
		_measure(count)
	quit()


func _measure(per_side: int) -> void:
	var world := IdWorld.new({
		"seed": 777,
		"players": [
			{"name": "A", "faction": "vanguard"},
			{"name": "B", "faction": "legion"},
		],
	})

	# Two armies facing each other across the middle of the map, so they are
	# all in each other's acquisition range: the worst case, not the average.
	for side in range(2):
		var p: IdPlayer = world.players[side]
		var roster: Dictionary = IdUnitDefs.roster(p.faction)
		var sign := 1.0 if side == 0 else -1.0
		var per_row := 28
		for i in range(per_side):
			var row := i / per_row
			var col := i % per_row
			world.spawn(
				roster["assault"], side,
				world.map.width * 0.5 + sign * (260.0 + row * 30.0),
				world.map.height * 0.5 + (col - per_row * 0.5) * 30.0,
				{"complete": true}
			)
		for e in world.units_of(side):
			e.orders.append({
				"type": IdOrders.ATTACK_MOVE,
				"x": world.map.width * 0.5 - sign * 400.0,
				"y": world.map.height * 0.5,
			})

	# Let them close and engage before measuring.
	for i in range(IdWorld.SIM_HZ * 6):
		world.tick()

	var ticks := 120
	world.profile = true
	world.phase_us.clear()
	var t0 := Time.get_ticks_usec()
	for i in range(ticks):
		world.tick()
	var per_tick := float(Time.get_ticks_usec() - t0) / 1000.0 / float(ticks)

	var alive := 0
	for e in world.entities:
		if e.alive:
			alive += 1
	# A match that has already ended does no work, so timing it says nothing.
	if world.game_over:
		print("%4d per side: match already over, not measured" % per_side)
		world.dispose()
		return

	var parts: Array[String] = []
	for name in ["orders", "combat", "movement", "grid", "projectiles", "economy", "ai", "pathfinding"]:
		var ms: float = float(world.phase_us.get(name, 0)) / 1000.0 / float(ticks)
		if ms >= 0.05:
			parts.append("%s %.1f" % [name, ms])
	print("%4d per side: %6.2f ms/tick   %4d alive   %s   %s"
		% [per_side, per_tick, alive, ", ".join(parts),
			"ok" if per_tick < 33.0 else "OVER"])
	world.dispose()
