class_name IdPathfinder
extends RefCounted

## Path requests, budgeting and smoothing, over Godot's native grid search.
##
## The original's A* was ported by hand first and measured at 35ms a path
## against 0.42ms for the same search in JavaScript: GDScript runs the inner
## loop interpreted, and a grid search is almost entirely inner loop.
## AStarGrid2D does the same job in C++ at 0.57ms, so the search itself is left
## to the engine and this keeps the parts that are actually game design - the
## per-tick budget, resolving a goal inside a building, and string-pulling the
## result down to a handful of waypoints instead of one per cell.

var map: IdGameMap
var budget_per_tick: int = 12

var _grid: AStarGrid2D
var _budget: int = 0
var _requests: Array[Dictionary] = []

var searches: int = 0
var failures: int = 0

# Direct handles on the map's arrays. The line-of-sight test runs hundreds of
# times per path, and in GDScript a method call with bounds checks costs more
# than the work it guards.
var _terrain: PackedByteArray
var _blocked: PackedByteArray
var _cols: int = 0
var _rows: int = 0
var _cell_f: float = 16.0

func _init(game_map: IdGameMap) -> void:
	map = game_map
	_terrain = map.terrain
	_blocked = map.blocked
	_cols = map.cols
	_rows = map.rows
	_cell_f = float(map.cell)
	_grid = AStarGrid2D.new()
	_grid.region = Rect2i(0, 0, map.cols, map.rows)
	_grid.cell_size = Vector2(map.cell, map.cell)
	# Matches the original's rule: no cutting the corner between two blockers.
	_grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	_grid.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	_grid.default_estimate_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	_grid.update()
	rebuild()
	_budget = budget_per_tick

## Re-read passability for the whole map. Used once at startup.
func rebuild() -> void:
	for cy in map.rows:
		for cx in map.cols:
			_grid.set_point_solid(Vector2i(cx, cy), not map.is_passable_cell(cx, cy))

## Keep the search grid in step when a structure occupies or frees cells.
func update_footprint(cx0: int, cy0: int, size: int) -> void:
	for cy in range(cy0, cy0 + size):
		for cx in range(cx0, cx0 + size):
			if map.in_bounds(cx, cy):
				_grid.set_point_solid(Vector2i(cx, cy), not map.is_passable_cell(cx, cy))

# -------------------------------------------------------------- requests

func begin_tick() -> void:
	_budget = budget_per_tick

## Queue a path request. `on_path` receives an Array of Vector2 waypoints, or
## an empty array when no route exists.
func request(sx: float, sy: float, tx: float, ty: float, on_path: Callable, priority: int = 0) -> void:
	_requests.append({
		"sx": sx, "sy": sy, "tx": tx, "ty": ty,
		"on_path": on_path, "priority": priority,
	})

func process_requests() -> void:
	if _requests.is_empty():
		return
	if _requests.size() > 1:
		_requests.sort_custom(func(a, b): return int(a["priority"]) > int(b["priority"]))
	var ran := 0
	while not _requests.is_empty() and ran < _budget:
		var req: Dictionary = _requests.pop_front()
		ran += 1
		req["on_path"].call(find_path(req["sx"], req["sy"], req["tx"], req["ty"]))
	if _requests.size() > 600:
		_requests.resize(600)

# ---------------------------------------------------------------- search

func _nearest_open(cx: int, cy: int, max_radius: int) -> Vector2i:
	for r in range(1, max_radius + 1):
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if maxi(absi(dx), absi(dy)) != r:
					continue
				if map.is_passable_cell(cx + dx, cy + dy):
					return Vector2i(cx + dx, cy + dy)
	return Vector2i(-1, -1)

## Waypoints from start to goal, or an empty array when no route exists.
## The start position itself is not included.
func find_path(sx: float, sy: float, tx: float, ty: float) -> Array:
	var cell := float(map.cell)
	var from := Vector2i(int(floor(sx / cell)), int(floor(sy / cell)))
	var to := Vector2i(int(floor(tx / cell)), int(floor(ty / cell)))

	if not map.in_bounds(from.x, from.y) or not map.in_bounds(to.x, to.y):
		return []

	# Standing inside a blocked cell starts the search from the nearest open
	# one rather than failing outright.
	if not map.is_passable_cell(from.x, from.y):
		from = _nearest_open(from.x, from.y, 6)
		if from.x < 0:
			return []

	# A goal inside a building or on water resolves to the closest open cell,
	# which is what "move next to that thing" should mean.
	var goal_exact := true
	if not map.is_passable_cell(to.x, to.y):
		to = _nearest_open(to.x, to.y, 10)
		if to.x < 0:
			return []
		goal_exact = false

	searches += 1
	if from == to:
		return [Vector2(tx, ty)] if goal_exact else [_cell_centre(to)]

	var raw := _grid.get_point_path(from, to)
	if raw.size() < 2:
		failures += 1
		return []

	# get_point_path includes the starting cell; drop it, and replace the final
	# cell centre with the exact destination when it was reachable.
	var points: Array = []
	for i in range(1, raw.size()):
		points.append(Vector2(raw[i].x, raw[i].y))
	if goal_exact and not points.is_empty():
		points[points.size() - 1] = Vector2(tx, ty)

	return _smooth(sx, sy, points)

func _cell_centre(c: Vector2i) -> Vector2:
	return Vector2((float(c.x) + 0.5) * float(map.cell), (float(c.y) + 0.5) * float(map.cell))

## String pulling: keep an anchor and extend along the path while the straight
## line stays walkable, emitting a waypoint at the last clear point.
##
## Scanning backwards from the end for the furthest visible point gives
## slightly shorter paths but costs a line test per candidate; walking forwards
## costs one per point, which matters when this runs for every unit.
func _smooth(sx: float, sy: float, points: Array) -> Array:
	if points.size() <= 2:
		return points
	var out: Array = []
	var anchor := Vector2(sx, sy)
	var last_clear := -1
	var i := 0
	var anchor_at := 0
	while i < points.size():
		if i - anchor_at > SMOOTH_LOOKAHEAD:
			# Too far from the anchor to be worth testing; commit and move on.
			var commit: int = maxi(last_clear, anchor_at)
			out.append(points[commit])
			anchor = points[commit]
			anchor_at = commit
			i = commit + 1
			last_clear = -1
			continue
		if has_line_of_walk(anchor.x, anchor.y, points[i].x, points[i].y):
			last_clear = i
			i += 1
			continue
		# The line broke: commit the last point we could see and start again.
		if last_clear < 0:
			last_clear = i
		out.append(points[last_clear])
		anchor = points[last_clear]
		anchor_at = last_clear
		i = last_clear + 1
		last_clear = -1
	if out.is_empty() or out[out.size() - 1] != points[points.size() - 1]:
		out.append(points[points.size() - 1])
	return out

## Sample the straight segment for blocked cells.
##
## Steps once per cell rather than twice, and reads the terrain arrays
## directly: this runs a few hundred times per path and was the single most
## expensive thing left once the search moved into the engine.
func has_line_of_walk(x0: float, y0: float, x1: float, y1: float) -> bool:
	var dx := x1 - x0
	var dy := y1 - y0
	var dist := sqrt(dx * dx + dy * dy)
	var steps := int(dist / _cell_f) + 1
	var inv := 1.0 / float(steps)
	var last_cx := -1
	var last_cy := -1
	for s in range(1, steps + 1):
		var t := float(s) * inv
		var cx := int((x0 + dx * t) / _cell_f)
		var cy := int((y0 + dy * t) / _cell_f)
		# Consecutive samples often land in the same cell; skip the repeat.
		if cx == last_cx and cy == last_cy:
			continue
		last_cx = cx
		last_cy = cy
		if cx < 0 or cy < 0 or cx >= _cols or cy >= _rows:
			return false
		var i := cy * _cols + cx
		if _terrain[i] != IdGameMap.TERRAIN_LAND or _blocked[i] != 0:
			return false
	return true

## Cap on how far ahead smoothing looks for a clear line.
##
## Testing every remaining point against the current anchor makes the work grow
## with the square of the path length for no real gain: beyond a couple of
## dozen cells the line is almost never clear anyway, and the extra waypoints
## cost nothing to follow.
const SMOOTH_LOOKAHEAD: int = 20
