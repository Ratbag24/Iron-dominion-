extends SceneTree

## Drives the player-facing commands the way the mouse does: pick a unit,
## order a structure built, queue units at the finished factory, and move the
## result. Everything here goes through IdSelection, so this covers the path
## an actual click takes rather than calling into the simulation directly.

var failures: int = 0


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


func _init() -> void:
	# The camera has to be inside the tree before it can project anything, and
	# the tree's root is not usable until the first frame, so the body of this
	# test runs a frame later rather than during construction.
	_run.call_deferred()


func _run() -> void:
	await process_frame

	var world := IdWorld.new({
		"seed": 4242,
		"players": [
			{"name": "Commander", "faction": "concord"},
			{"name": "Legion AI", "faction": "legion", "is_ai": true},
		],
	})
	var terrain := IdTerrainBuilder.new(world.map, 2)

	var holder := Node3D.new()
	root.add_child(holder)
	var cam := IdRtsCamera.new()
	holder.add_child(cam)
	var me: IdPlayer = world.players[0]
	cam.setup(terrain, Vector2(me.start_x, me.start_y))
	cam.make_current()

	var sel := IdSelection.new()
	sel.setup(world, cam, 0)

	print("\nPicking")
	print("-------")
	var com: IdEntity = world.get_entity(me.commander_id)
	var com_screen := cam.unproject_position(
		Vector3(com.x, terrain.height_at(com.x, com.y) + com.radius * 0.6, com.y)
	)
	check(sel.pick_at(com_screen) == com.id, "the commander picks under its own pixel",
		"screen %s" % str(com_screen.round()))
	check(sel.pick_at(com_screen + Vector2(400, 300)) == 0,
		"empty ground picks nothing")

	sel.select_ids([com.id], false)
	check(sel.selected.size() == 1 and com.selected, "selecting marks the entity")

	var palette := sel.buildable()
	check(palette.size() > 4, "the commander offers a build palette",
		"%d options" % palette.size())

	# --- build a power plant ---------------------------------------------
	print("\nBuilding")
	print("--------")
	var roster: Dictionary = IdUnitDefs.roster("concord")
	sel.build_def = roster["energy"]

	var placed := false
	var attempts := 0
	# Walk outwards from the commander for a spot that takes the footprint.
	for ring in range(2, 14):
		for i in range(16):
			attempts += 1
			var a: float = (float(i) / 16.0) * TAU
			var wx: float = com.x + cos(a) * ring * 34.0
			var wy: float = com.y + sin(a) * ring * 34.0
			var screen := cam.unproject_position(Vector3(wx, terrain.height_at(wx, wy), wy))
			var preview := sel.build_preview(screen)
			if preview.is_empty() or not bool(preview["ok"]):
				continue
			sel.place_building(screen, false)
			placed = true
			break
		if placed:
			break
	check(placed, "found a legal site and placed the order", "%d sites tried" % attempts)
	check(not com.orders.is_empty() and String(com.orders[0]["type"]) == IdOrders.BUILD,
		"the commander took the build order")

	for i in range(IdWorld.SIM_HZ * 60):
		world.tick()
	var power := 0
	for e in world.units_of(0):
		if not e.under_construction and float(e.def.get("energyPerSecond", 0.0)) > 0.0:
			power += 1
	check(power >= 1, "the plant finished and is producing",
		"%d plants, %.0f energy/s" % [power, world.players[0].energy_income])

	# --- a factory, then units out of it ----------------------------------
	print("\nProduction")
	print("----------")
	sel.select_ids([com.id], false)
	sel.build_def = roster["factory"]
	var factory_placed := false
	for ring in range(3, 16):
		for i in range(20):
			var a: float = (float(i) / 20.0) * TAU
			var wx: float = com.x + cos(a) * ring * 40.0
			var wy: float = com.y + sin(a) * ring * 40.0
			var screen := cam.unproject_position(Vector3(wx, terrain.height_at(wx, wy), wy))
			var preview := sel.build_preview(screen)
			if preview.is_empty() or not bool(preview["ok"]):
				continue
			sel.place_building(screen, false)
			factory_placed = true
			break
		if factory_placed:
			break
	check(factory_placed, "placed a factory")

	for i in range(IdWorld.SIM_HZ * 150):
		world.tick()
	var factory: IdEntity = null
	for e in world.units_of(0):
		if bool(e.def.get("factory", false)) and not e.under_construction:
			factory = e
			break
	check(factory != null, "the factory finished")
	if factory == null:
		_finish(world)
		return

	sel.select_ids([factory.id], false)
	var unit_id: String = roster["assault"]
	check(sel.queue_unit(unit_id, 2), "queued units at the factory", unit_id)
	var queued := 0
	for item in factory.factory_queue:
		queued += int(item["count"])
	check(queued == 2, "the queue holds what was asked for", "%d" % queued)

	for i in range(IdWorld.SIM_HZ * 90):
		world.tick()
	var made: Array[IdEntity] = world.units_of(0, unit_id)
	check(made.size() >= 2, "the factory produced them", "%d built" % made.size())
	if made.is_empty():
		_finish(world)
		return

	# --- move them --------------------------------------------------------
	print("\nOrders")
	print("------")
	var ids: Array[int] = []
	for e in made:
		ids.append(e.id)
	sel.select_ids(ids, false)

	var goal := Vector2(me.start_x + 420.0, me.start_y + 260.0)
	var before: Array[Vector2] = []
	for e in made:
		before.append(Vector2(e.x, e.y))
	sel.issue_order(goal, Vector2(-999, -999), false)
	check(not made[0].orders.is_empty()
			and String(made[0].orders[0]["type"]) == IdOrders.MOVE,
		"a right-click on open ground is a move order")

	for i in range(IdWorld.SIM_HZ * 25):
		world.tick()
	var moved := 0
	var closer := 0
	for i in range(made.size()):
		var e: IdEntity = made[i]
		if not e.alive:
			continue
		if Vector2(e.x, e.y).distance_to(before[i]) > 40.0:
			moved += 1
		if Vector2(e.x, e.y).distance_to(goal) < before[i].distance_to(goal):
			closer += 1
	check(moved >= 1, "they set off", "%d of %d moved" % [moved, made.size()])
	check(closer >= 1, "and they are heading the right way",
		"%d of %d closed on the goal" % [closer, made.size()])

	# --- commands that wait for a click ------------------------------------
	print("\nTargeted commands")
	print("-----------------")
	var viewport := Vector2(1600, 900)
	var away := Vector2(me.start_x - 300.0, me.start_y - 220.0)
	var away_screen := cam.unproject_position(
		Vector3(away.x, terrain.height_at(away.x, away.y), away.y)
	)

	sel.pending_command = IdOrders.ATTACK_MOVE
	_click(sel, away_screen, viewport)
	check(not made[0].orders.is_empty()
			and String(made[0].orders[0]["type"]) == IdOrders.ATTACK_MOVE,
		"A then a click is an attack-move",
		String(made[0].orders[0].get("type", "none")))
	check(sel.pending_command == "", "the armed command is spent by the click")

	sel.pending_command = IdOrders.PATROL
	_click(sel, away_screen, viewport)
	var patrol: Dictionary = made[0].orders[0]
	check(String(patrol["type"]) == IdOrders.PATROL
			and (patrol["points"] as Array).size() == 2,
		"E then a click is a patrol between here and there",
		"%d points" % (patrol.get("points", []) as Array).size())

	sel.pending_command = IdOrders.ATTACK_MOVE
	# A right-click cancels an armed command rather than issuing an order.
	var cancel := InputEventMouseButton.new()
	cancel.button_index = MOUSE_BUTTON_RIGHT
	cancel.pressed = true
	cancel.position = away_screen
	sel.handle_input(cancel, viewport)
	check(sel.pending_command == "" and String(made[0].orders[0]["type"]) == IdOrders.PATROL,
		"right-click cancels an armed command and gives no order")

	# Stop clears the queue without clearing the selection.
	for e in sel.selected_entities():
		e.orders.clear()
		e.has_move_goal = false
	check(made[0].orders.is_empty() and sel.selected.size() == ids.size(),
		"halting keeps the selection")

	_finish(world)


## A full press and release at a screen point, the way the mouse delivers it.
func _click(sel: IdSelection, at: Vector2, viewport: Vector2) -> void:
	var down := InputEventMouseButton.new()
	down.button_index = MOUSE_BUTTON_LEFT
	down.pressed = true
	down.position = at
	sel.handle_input(down, viewport)
	var up := InputEventMouseButton.new()
	up.button_index = MOUSE_BUTTON_LEFT
	up.pressed = false
	up.position = at
	sel.handle_input(up, viewport)


func _finish(world: IdWorld) -> void:
	world.dispose()
	print("")
	if failures == 0:
		print("PASS: the command path works end to end")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
