extends SceneTree

## Checks the scene really does follow the simulation: a node per living
## entity, the right heading, units lying along the ground they stand on, and
## nothing drawn for an enemy nobody can see.

var failures: int = 0


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	await process_frame

	var world := IdWorld.new({
		"seed": 909,
		"players": [
			{"name": "Mine", "faction": "vanguard"},
			{"name": "Theirs", "faction": "legion", "is_ai": true},
		],
	})
	var terrain := IdTerrainBuilder.new(world.map, 2)

	var view := IdUnitView.new()
	root.add_child(view)
	view.setup(world, terrain, 0)
	view.sync()

	print("\nScene")
	print("-----")
	var me: IdPlayer = world.players[0]
	var com: IdEntity = world.get_entity(me.commander_id)
	var node: Node3D = view.node_for(com.id)
	check(node != null, "the commander has a node")
	if node == null:
		_finish(world, view)
		return

	check(node.position.distance_to(
			Vector3(com.x, terrain.height_at(com.x, com.y), com.y)) < 0.01,
		"it stands where the simulation says", str(node.position.round()))

	# The enemy commander is across the map and unseen, so nothing is drawn.
	var foe: IdEntity = world.get_entity(world.players[1].commander_id)
	check(view.node_for(foe.id) == null, "an unseen enemy is not drawn")

	print("\nHeading")
	print("-------")
	# A unit's nose should point where its heading says, whatever the slope.
	var roster: Dictionary = IdUnitDefs.roster("vanguard")
	var unit: IdEntity = world.spawn(
		roster["raider"], 0, me.start_x + 60.0, me.start_y + 40.0, {"complete": true}
	)
	var worst := 0.0
	for degrees in [0, 45, 90, 180, 270]:
		unit.heading = deg_to_rad(float(degrees))
		view.sync()
		var n: Node3D = view.node_for(unit.id)
		# These models are built facing +X - that is the way the gun barrels
		# point in the source they were exported from - so the node's own X
		# axis is its nose, not Godot's usual -Z.
		var forward: Vector3 = n.transform.basis.x
		var want := Vector2(cos(unit.heading), sin(unit.heading))
		var got := Vector2(forward.x, forward.z).normalized()
		worst = maxf(worst, absf(IdMath.angle_delta(want.angle(), got.angle())))
	check(worst < 0.02, "headings survive the trip into the scene",
		"worst error %.3f rad" % worst)

	print("\nGround")
	print("------")
	# On a slope the unit leans; its up vector should match the terrain's.
	var leaned := 0
	var upright := 0
	for e in world.entities:
		if e.is_building:
			continue
		var n: Node3D = view.node_for(e.id)
		if n == null:
			continue
		var up: Vector3 = n.transform.basis.y
		if up.angle_to(Vector3.UP) > 0.02:
			leaned += 1
		else:
			upright += 1
	check(leaned + upright > 0, "mobile units are drawn",
		"%d leaning, %d level" % [leaned, upright])

	# Put one on a deliberate slope and confirm it follows it.
	var slope_found := false
	for cy in range(4, world.map.rows - 4, 3):
		for cx in range(4, world.map.cols - 4, 3):
			if not world.map.is_passable_cell(cx, cy):
				continue
			var x := (cx + 0.5) * world.map.cell
			var y := (cy + 0.5) * world.map.cell
			var dx := terrain.height_at(x + 14.0, y) - terrain.height_at(x - 14.0, y)
			if absf(dx) < 6.0:
				continue
			unit.x = x
			unit.y = y
			view.sync()
			var up: Vector3 = view.node_for(unit.id).transform.basis.y
			check(up.angle_to(Vector3.UP) > 0.05,
				"a unit on a hillside leans with it",
				"%.1f degrees on a %.1f unit drop" % [rad_to_deg(up.angle_to(Vector3.UP)), dx])
			slope_found = true
			break
		if slope_found:
			break
	check(slope_found, "the map has a slope to test on")

	print("\nRemoval")
	print("-------")
	world.kill(unit, null)
	world._cleanup()
	view.sync()
	check(view.node_for(unit.id) == null, "a dead unit's node is dropped")

	_finish(world, view)


func _finish(world: IdWorld, view: IdUnitView) -> void:
	view.clear()
	world.dispose()
	print("")
	if failures == 0:
		print("PASS: the scene follows the simulation")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
