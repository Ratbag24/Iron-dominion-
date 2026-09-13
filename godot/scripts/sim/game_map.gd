class_name IdGameMap
extends RefCounted

## Procedural map generation.
##
## A direct port of the JavaScript original, kept faithful down to the storage
## precision: heights live in a 32-bit packed array because the original used a
## Float32Array, and rounding on store is observable in the percentile cut-offs
## that classify terrain. The parity test checks this against values dumped
## from the reference build.
##
## Maps are 180-degree rotationally symmetric, so neither start position gets a
## better share of the metal spots.

const TERRAIN_LAND: int = 0
const TERRAIN_WATER: int = 1
const TERRAIN_ROCK: int = 2
const BUILD_CELL: int = 16

var width: int = 3072
var height: int = 3072
var cell: int = BUILD_CELL
var cols: int = 0
var rows: int = 0
var map_seed: int = 1

var terrain: PackedByteArray = PackedByteArray()
var heights: PackedFloat32Array = PackedFloat32Array()
var blocked: PackedByteArray = PackedByteArray()

var water_line: float = 0.0
var rock_line: float = 0.0

## Each spot: { cx, cy, x, y, yield, taken, owner_id }
var metal_spots: Array[Dictionary] = []
## Each start: { cx, cy, x, y }
var start_positions: Array[Dictionary] = []

var _reachable: PackedByteArray = PackedByteArray()

func _init(seed_value: int = 12345, map_width: int = 3072, map_height: int = 3072) -> void:
	width = map_width
	height = map_height
	cols = int(float(width) / float(cell))
	rows = int(float(height) / float(cell))
	# Mirrors `opts.seed >>> 0 || 1`: zero falls back to one.
	map_seed = seed_value & 0xFFFFFFFF
	if map_seed == 0:
		map_seed = 1

	terrain.resize(cols * rows)
	heights.resize(cols * rows)
	blocked.resize(cols * rows)
	_generate()

func idx(cx: int, cy: int) -> int:
	return cy * cols + cx

func in_bounds(cx: int, cy: int) -> bool:
	return cx >= 0 and cy >= 0 and cx < cols and cy < rows

func terrain_at(x: float, y: float) -> int:
	var cx := int(x / float(cell))
	var cy := int(y / float(cell))
	if not in_bounds(cx, cy):
		return TERRAIN_ROCK
	return terrain[idx(cx, cy)]

func height_at(x: float, y: float) -> float:
	var cx := int(x / float(cell))
	var cy := int(y / float(cell))
	if not in_bounds(cx, cy):
		return 0.0
	return heights[idx(cx, cy)]

func is_passable_cell(cx: int, cy: int) -> bool:
	if not in_bounds(cx, cy):
		return false
	var i := idx(cx, cy)
	return terrain[i] == TERRAIN_LAND and blocked[i] == 0

func is_passable(x: float, y: float) -> bool:
	return is_passable_cell(int(x / float(cell)), int(y / float(cell)))

func set_blocked(cx0: int, cy0: int, size: int, value: int) -> void:
	for cy in range(cy0, cy0 + size):
		for cx in range(cx0, cx0 + size):
			if in_bounds(cx, cy):
				blocked[idx(cx, cy)] = value

## Snap a world position to the build grid for a footprint of `size` cells.
func snap_footprint(x: float, y: float, size: int) -> Dictionary:
	var half := float(size) * float(cell) * 0.5
	var cx := int(round((x - half) / float(cell)))
	var cy := int(round((y - half) / float(cell)))
	cx = clampi(cx, 0, cols - size)
	cy = clampi(cy, 0, rows - size)
	return {
		"cx": cx, "cy": cy,
		"x": float(cx * cell) + half,
		"y": float(cy * cell) + half,
	}

func can_place(cx: int, cy: int, size: int) -> bool:
	for y in range(cy, cy + size):
		for x in range(cx, cx + size):
			if not is_passable_cell(x, y):
				return false
	return true

func nearest_free_metal_spot(x: float, y: float, max_dist: float = INF) -> Dictionary:
	var best: Dictionary = {}
	var best_d := max_dist * max_dist
	for s in metal_spots:
		if s["taken"]:
			continue
		var dx: float = s["x"] - x
		var dy: float = s["y"] - y
		var d := dx * dx + dy * dy
		if d < best_d:
			best_d = d
			best = s
	return best

func metal_spot_near(x: float, y: float, radius: float = 40.0) -> Dictionary:
	for s in metal_spots:
		var dx: float = s["x"] - x
		var dy: float = s["y"] - y
		if dx * dx + dy * dy <= radius * radius:
			return s
	return {}

# ----------------------------------------------------------------- generation

func _generate() -> void:
	var rng := IdRng.new(map_seed)
	var noise := IdNoise2D.new(map_seed)
	var detail := IdNoise2D.new(map_seed ^ 0x9E3779B9)

	# Averaging a sample with its 180-degree counterpart makes the field
	# symmetric by construction.
	var scale := 3.4 / float(cols)
	for cy in rows:
		for cx in cols:
			var ox := cols - 1 - cx
			var oy := rows - 1 - cy
			var a := noise.fbm(float(cx) * scale, float(cy) * scale, 5)
			var b := noise.fbm(float(ox) * scale, float(oy) * scale, 5)
			var h := (a + b) * 0.5
			var da := detail.fbm(float(cx) * scale * 4.0, float(cy) * scale * 4.0, 3)
			var db := detail.fbm(float(ox) * scale * 4.0, float(oy) * scale * 4.0, 3)
			h += ((da + db) * 0.5 - 0.5) * 0.09
			heights[idx(cx, cy)] = h

	# Classify by percentile. Averaging narrows the distribution by an amount
	# that varies with the seed, so absolute cut-offs would give wildly
	# different maps from one seed to the next.
	var sorted := heights.duplicate()
	sorted.sort()
	var water := sorted[mini(sorted.size() - 1, int(floor(float(sorted.size()) * 0.16)))]
	var rock := sorted[mini(sorted.size() - 1, int(floor(float(sorted.size()) * 0.88)))]
	var lo := sorted[0]
	var hi := sorted[sorted.size() - 1]
	var span := maxf(1e-6, hi - lo)

	for i in terrain.size():
		var h := heights[i]
		terrain[i] = TERRAIN_WATER if h < water else (TERRAIN_ROCK if h > rock else TERRAIN_LAND)
		heights[i] = (h - lo) / span
	water_line = (water - lo) / span
	rock_line = (rock - lo) / span

	_pick_start_positions()
	_place_metal_spots(rng)
	_ensure_connectivity()

func _pick_start_positions() -> void:
	var margin := int(floor(float(cols) * 0.16))
	var best := {"cx": margin, "cy": margin}
	var best_score := -INF
	var cy := margin
	while float(cy) < float(rows) * 0.42:
		var cx := margin
		while float(cx) < float(cols) * 0.42:
			var score := _openness_score(cx, cy, 7)
			if score > best_score:
				best_score = score
				best = {"cx": cx, "cy": cy}
			cx += 2
		cy += 2

	_carve_clearing(best["cx"], best["cy"], 9)
	var mirror := {"cx": cols - 1 - int(best["cx"]), "cy": rows - 1 - int(best["cy"])}
	_carve_clearing(mirror["cx"], mirror["cy"], 9)

	start_positions.clear()
	for p in [best, mirror]:
		start_positions.append({
			"cx": p["cx"], "cy": p["cy"],
			"x": (float(p["cx"]) + 0.5) * float(cell),
			"y": (float(p["cy"]) + 0.5) * float(cell),
		})

func _openness_score(cx: int, cy: int, r: int) -> float:
	var land := 0
	var total := 0
	var min_h := INF
	var max_h := -INF
	for y in range(cy - r, cy + r + 1):
		for x in range(cx - r, cx + r + 1):
			if not in_bounds(x, y):
				return -INF
			total += 1
			var i := idx(x, y)
			if terrain[i] == TERRAIN_LAND:
				land += 1
			var h := heights[i]
			min_h = minf(min_h, h)
			max_h = maxf(max_h, h)
	# Prefer flat, open ground, and push starts away from the centre so the two
	# players are not crowded together on lopsided terrain.
	var cx_mid := float(cols - 1) * 0.5
	var cy_mid := float(rows - 1) * 0.5
	var from_centre := sqrt(pow(float(cx) - cx_mid, 2.0) + pow(float(cy) - cy_mid, 2.0)) \
		/ sqrt(cx_mid * cx_mid + cy_mid * cy_mid)
	return (float(land) / float(total)) * 100.0 - (max_h - min_h) * 60.0 + from_centre * 45.0

## Flatten a disc into a buildable clearing, feathered at the edges so a base
## sits in the landscape rather than on a sheer-sided mesa.
func _carve_clearing(cx: int, cy: int, r: int) -> void:
	var mid := (water_line + rock_line) * 0.5
	var total := 0.0
	var n := 0
	for y in range(cy - r, cy + r + 1):
		for x in range(cx - r, cx + r + 1):
			if not in_bounds(x, y):
				continue
			if pow(x - cx, 2.0) + pow(y - cy, 2.0) > float(r * r):
				continue
			total += heights[idx(x, y)]
			n += 1
	var flat := (total / float(n)) if n > 0 else mid
	flat = minf(maxf(flat, water_line + 0.06), rock_line - 0.06)

	var outer := int(float(r) * 1.9)
	for y in range(cy - outer, cy + outer + 1):
		for x in range(cx - outer, cx + outer + 1):
			if not in_bounds(x, y):
				continue
			var d := sqrt(pow(float(x - cx), 2.0) + pow(float(y - cy), 2.0))
			if d > float(outer):
				continue
			var t := clampf((d - float(r) * 0.65) / (float(outer) - float(r) * 0.65), 0.0, 1.0)
			var w := 1.0 - t * t * (3.0 - 2.0 * t)
			var i := idx(x, y)
			heights[i] = heights[i] + (flat - heights[i]) * w
			if d <= float(r):
				terrain[i] = TERRAIN_LAND
			else:
				var h := heights[i]
				terrain[i] = TERRAIN_WATER if h < water_line else (TERRAIN_ROCK if h > rock_line else TERRAIN_LAND)

func _place_metal_spots(rng: IdRng) -> void:
	var spots: Array[Dictionary] = []
	var min_gap := float(cell) * 7.0
	var centre_x := float(cols - 1) * 0.5
	var centre_y := float(rows - 1) * 0.5

	var try_add := func(cx: int, cy: int, yield_value: float) -> bool:
		if not in_bounds(cx, cy):
			return false
		if terrain[idx(cx, cy)] != TERRAIN_LAND:
			return false
		if not can_place(cx - 1, cy - 1, 3):
			return false
		var x := (float(cx) + 0.5) * float(cell)
		var y := (float(cy) + 0.5) * float(cell)
		for s in spots:
			var dx: float = s["x"] - x
			var dy: float = s["y"] - y
			if dx * dx + dy * dy < min_gap * min_gap:
				return false
		spots.append({
			"cx": cx, "cy": cy, "x": x, "y": y,
			"yield": yield_value, "taken": false, "owner_id": -1,
		})
		return true

	# Guaranteed spots around each start, mirrored automatically.
	var start: Dictionary = start_positions[0]
	var ring := [
		Vector2i(-4, -4), Vector2i(4, -4), Vector2i(-4, 4), Vector2i(4, 4),
		Vector2i(0, -7), Vector2i(7, 0), Vector2i(-7, 0), Vector2i(0, 7),
	]
	for offset in ring:
		var cx: int = int(start["cx"]) + offset.x
		var cy: int = int(start["cy"]) + offset.y
		if try_add.call(cx, cy, 1.0):
			try_add.call(cols - 1 - cx, rows - 1 - cy, 1.0)

	# Contested spots over the rest of the map, always in pairs.
	var attempts := 0
	while spots.size() < 40 and attempts < 4000:
		attempts += 1
		var cx := rng.range_i(3, cols - 4)
		var cy := rng.range_i(3, rows - 4)
		var mx := cols - 1 - cx
		var my := rows - 1 - cy
		# Skip the exact centre cell, which maps onto itself.
		if absf(float(cx) - centre_x) < 1.0 and absf(float(cy) - centre_y) < 1.0:
			continue
		var yield_value := 1.6 if rng.chance(0.22) else 1.0
		var before := spots.size()
		if try_add.call(cx, cy, yield_value):
			if not try_add.call(mx, my, yield_value):
				spots.resize(before)  # keep pairs honest

	metal_spots = spots

## Guarantee the two starts are connected by land, carving a corridor rather
## than rerolling the whole map.
func _ensure_connectivity() -> void:
	var a: Dictionary = start_positions[0]
	var b: Dictionary = start_positions[1]
	var reach := _flood_fill(int(a["cx"]), int(a["cy"]))
	if reach[idx(int(b["cx"]), int(b["cy"]))] == 1:
		_reachable = reach
		_prune_unreachable_spots(reach)
		return
	_carve_corridor(a, b)
	var reach2 := _flood_fill(int(a["cx"]), int(a["cy"]))
	_reachable = reach2
	_prune_unreachable_spots(reach2)

func _flood_fill(sx: int, sy: int) -> PackedByteArray:
	var seen := PackedByteArray()
	seen.resize(cols * rows)
	var queue := PackedInt32Array()
	queue.resize(cols * rows)
	var head := 0
	var tail := 0
	var start := idx(sx, sy)
	seen[start] = 1
	queue[tail] = start
	tail += 1
	while head < tail:
		var i := queue[head]
		head += 1
		var cx := i % cols
		var cy := int(i / cols)
		for d in 4:
			var nx := cx + (1 if d == 0 else (-1 if d == 1 else 0))
			var ny := cy + (1 if d == 2 else (-1 if d == 3 else 0))
			if not in_bounds(nx, ny):
				continue
			var ni := idx(nx, ny)
			if seen[ni] == 1 or terrain[ni] != TERRAIN_LAND:
				continue
			seen[ni] = 1
			queue[tail] = ni
			tail += 1
	return seen

func _carve_corridor(a: Dictionary, b: Dictionary) -> void:
	var x: int = int(a["cx"])
	var y: int = int(a["cy"])
	var bx: int = int(b["cx"])
	var by: int = int(b["cy"])
	var guard := 0
	var mid := (water_line + rock_line) * 0.5
	while (x != bx or y != by) and guard < 20000:
		guard += 1
		for oy in range(-2, 3):
			for ox in range(-2, 3):
				if not in_bounds(x + ox, y + oy):
					continue
				var i := idx(x + ox, y + oy)
				terrain[i] = TERRAIN_LAND
				if heights[i] < water_line:
					heights[i] = mid
				if heights[i] > rock_line:
					heights[i] = mid
		if x != bx:
			x += signi(bx - x)
		if y != by:
			y += signi(by - y)

func _prune_unreachable_spots(reach: PackedByteArray) -> void:
	var kept: Array[Dictionary] = []
	for s in metal_spots:
		if reach[idx(int(s["cx"]), int(s["cy"]))] == 1:
			kept.append(s)
	metal_spots = kept
