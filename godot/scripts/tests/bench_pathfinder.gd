extends SceneTree

## Compares the hand-ported A* against Godot's native AStarGrid2D on the same
## map and the same routes. GDScript runs the ported inner loop interpreted;
## AStarGrid2D runs in C++.

func _init() -> void:
	var map := IdGameMap.new(42)
	var pf := IdPathfinder.new(map)

	# Build the native grid from the same passability rules.
	var grid := AStarGrid2D.new()
	grid.region = Rect2i(0, 0, map.cols, map.rows)
	grid.cell_size = Vector2(map.cell, map.cell)
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	grid.default_estimate_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	var t_build := Time.get_ticks_usec()
	grid.update()
	for cy in map.rows:
		for cx in map.cols:
			if not map.is_passable_cell(cx, cy):
				grid.set_point_solid(Vector2i(cx, cy), true)
	var build_ms := float(Time.get_ticks_usec() - t_build) / 1000.0

	var routes: Array = []
	for i in 40:
		var s: Dictionary = map.metal_spots[i % map.metal_spots.size()]
		var e: Dictionary = map.metal_spots[(i * 7 + 3) % map.metal_spots.size()]
		routes.append([Vector2(s["x"], s["y"]), Vector2(e["x"], e["y"])])

	var t0 := Time.get_ticks_usec()
	var ported_ok := 0
	for r in routes:
		if not pf.find_path(r[0].x, r[0].y, r[1].x, r[1].y).is_empty():
			ported_ok += 1
	var ported_ms := float(Time.get_ticks_usec() - t0) / 1000.0

	var t1 := Time.get_ticks_usec()
	var native_ok := 0
	var native_points := 0
	for r in routes:
		var from := Vector2i(int(r[0].x / map.cell), int(r[0].y / map.cell))
		var to := Vector2i(int(r[1].x / map.cell), int(r[1].y / map.cell))
		if grid.is_in_boundsv(from) and grid.is_in_boundsv(to) \
			and not grid.is_point_solid(from) and not grid.is_point_solid(to):
			var p := grid.get_point_path(from, to)
			if p.size() > 0:
				native_ok += 1
				native_points += p.size()
	var native_ms := float(Time.get_ticks_usec() - t1) / 1000.0

	print("grid build:        %.1fms (once per map)" % build_ms)
	print("ported GDScript:   %.2fms per path  (%d/%d routed)" % [ported_ms / routes.size(), ported_ok, routes.size()])
	print("native AStarGrid2D: %.2fms per path  (%d/%d routed, %d points average)" %
		[native_ms / routes.size(), native_ok, routes.size(), int(float(native_points) / float(maxi(1, native_ok)))])
	print("speed-up:          %.0fx" % (ported_ms / maxf(0.001, native_ms)))
	quit(0)
