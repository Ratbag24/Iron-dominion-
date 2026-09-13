extends SceneTree

## Exercises the ported pathfinder: routes must exist between the start
## positions, detours must go round obstacles rather than through them, and
## every waypoint on a returned path must be walkable.

var _failures := 0

func _check(name: String, ok: bool, detail: String = "") -> void:
	if ok:
		print("  PASS  %s%s" % [name, ("  (%s)" % detail) if detail != "" else ""])
	else:
		print("  FAIL  %s%s" % [name, ("  (%s)" % detail) if detail != "" else ""])
		_failures += 1

func _init() -> void:
	var map := IdGameMap.new(42)
	var pf := IdPathfinder.new(map)
	var a: Dictionary = map.start_positions[0]
	var b: Dictionary = map.start_positions[1]

	var t0 := Time.get_ticks_usec()
	var path := pf.find_path(a["x"], a["y"], b["x"], b["y"])
	var us := Time.get_ticks_usec() - t0
	_check("route exists between start positions", not path.is_empty(),
		"%d waypoints in %.1fms" % [path.size(), float(us) / 1000.0])

	# Every waypoint has to stand on walkable ground.
	var all_walkable := true
	for p in path:
		if not map.is_passable(p.x, p.y):
			all_walkable = false
	_check("every waypoint is walkable", all_walkable)

	# The final waypoint should be the requested destination.
	if not path.is_empty():
		var last: Vector2 = path[path.size() - 1]
		_check("path ends at the destination",
			last.distance_to(Vector2(b["x"], b["y"])) < float(map.cell) * 2.0,
			"%.0f units away" % last.distance_to(Vector2(b["x"], b["y"])))

	# Route between metal spots, which are scattered across the whole map.
	var ok := 0
	var failed := 0
	var detours := 0
	var total_us := 0
	for i in mini(60, map.metal_spots.size()):
		var s: Dictionary = map.metal_spots[i]
		var e: Dictionary = map.metal_spots[(i * 7 + 3) % map.metal_spots.size()]
		var straight := pf.has_line_of_walk(s["x"], s["y"], e["x"], e["y"])
		var t1 := Time.get_ticks_usec()
		var p := pf.find_path(s["x"], s["y"], e["x"], e["y"])
		total_us += Time.get_ticks_usec() - t1
		if p.is_empty():
			failed += 1
		else:
			ok += 1
			if not straight and p.size() > 1:
				detours += 1
	_check("paths found between metal spots", failed == 0,
		"%d ok, %d failed, %.1fms average" % [ok, failed, float(total_us) / 1000.0 / 60.0])
	_check("blocked routes produce real detours", detours > 0,
		"%d paths went round obstacles" % detours)

	# An unreachable goal should still return progress rather than nothing:
	# the search keeps the closest node it reached.
	var water := Vector2(-1, -1)
	for cy in map.rows:
		for cx in map.cols:
			if map.terrain[map.idx(cx, cy)] == IdGameMap.TERRAIN_WATER:
				water = Vector2((float(cx) + 0.5) * float(map.cell), (float(cy) + 0.5) * float(map.cell))
				break
		if water.x >= 0:
			break
	if water.x >= 0:
		var wp := pf.find_path(a["x"], a["y"], water.x, water.y)
		_check("a goal in water resolves to the nearest shore", not wp.is_empty(),
			"%d waypoints" % wp.size())

	# Placing a structure must close the cells it occupies to pathing.
	var start_cell := Vector2i(int(a["x"] / float(map.cell)), int(a["y"] / float(map.cell)))
	var block_x := start_cell.x + 3
	var block_y := start_cell.y
	var was_passable := map.is_passable_cell(block_x, block_y)
	map.set_blocked(block_x, block_y, 2, 1)
	pf.update_footprint(block_x, block_y, 2)
	var now_blocked := not map.is_passable_cell(block_x, block_y)
	var routed_round := pf.find_path(
		(float(block_x) - 2.0) * float(map.cell), (float(block_y) + 0.5) * float(map.cell),
		(float(block_x) + 4.0) * float(map.cell), (float(block_y) + 0.5) * float(map.cell))
	var avoids := true
	for p in routed_round:
		if not map.is_passable(p.x, p.y):
			avoids = false
	map.set_blocked(block_x, block_y, 2, 0)
	pf.update_footprint(block_x, block_y, 2)
	_check("a placed structure blocks pathing through it",
		was_passable and now_blocked and avoids and not routed_round.is_empty(),
		"%d waypoints around it" % routed_round.size())
	_check("removing it opens the ground again", map.is_passable_cell(block_x, block_y))

	print("")
	print("  %d searches, %d failures" % [pf.searches, pf.failures])
	if _failures == 0:
		print("PASS: pathfinding works on the ported map")
		quit(0)
	else:
		print("%d failures" % _failures)
		quit(1)
