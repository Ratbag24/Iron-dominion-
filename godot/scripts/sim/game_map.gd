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
## The hive's infection, 0..1 per cell. See creep.gd.
var corruption: PackedFloat32Array = PackedFloat32Array()
var blocked: PackedByteArray = PackedByteArray()

var water_line: float = 0.0
var rock_line: float = 0.0

## Each spot: { cx, cy, x, y, yield, taken, owner_id }
var metal_spots: Array[Dictionary] = []
## Each start: { cx, cy, x, y }
var start_positions: Array[Dictionary] = []

var _reachable: PackedByteArray = PackedByteArray()

## How many start positions the map is built for. Two is a mirrored duel; four
## is a square map in quarters. Anything else is clamped into that range.
var start_count: int = 2


## Whether the map is laid out in quarters rather than mirrored.
##
## Four-fold symmetry needs a square grid to rotate onto itself, so a
## non-square map stays a duel however many starts were asked for.
func four_fold() -> bool:
	return start_count > 2 and cols == rows


## The cell a quarter-turn clockwise about the centre of the map.
func rotate90(cx: int, cy: int) -> Vector2i:
	return Vector2i(rows - 1 - cy, cx)


## Every cell this one maps onto under the map's symmetry, itself included.
func symmetry_images(cx: int, cy: int) -> Array[Vector2i]:
	if not four_fold():
		return [Vector2i(cx, cy), Vector2i(cols - 1 - cx, rows - 1 - cy)]
	var out: Array[Vector2i] = [Vector2i(cx, cy)]
	var p := Vector2i(cx, cy)
	for _i in range(3):
		p = rotate90(p.x, p.y)
		out.append(p)
	return out


func _init(seed_value: int = 12345, map_width: int = 3072, map_height: int = 3072,
		starts: int = 2) -> void:
	width = map_width
	height = map_height
	cols = int(float(width) / float(cell))
	rows = int(float(height) / float(cell))
	# Mirrors `opts.seed >>> 0 || 1`: zero falls back to one.
	map_seed = seed_value & 0xFFFFFFFF
	if map_seed == 0:
		map_seed = 1
	start_count = clampi(starts, 2, 4)
	if start_count > 2 and cols != rows:
		push_warning("a map in quarters has to be square; falling back to a duel")
		start_count = 2

	terrain.resize(cols * rows)
	heights.resize(cols * rows)
	corruption.resize(cols * rows)
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

## As above, but `on_foot` units also cross rock.
##
## Rock is scree and broken slab: nothing with wheels, tracks or a metre-long
## stride gets over it, but troops scramble across. That single difference is
## what makes infantry worth building on maps this broken. Water still stops
## everyone, and a building still blocks its own footprint.
func is_passable_cell_for(cx: int, cy: int, on_foot: bool) -> bool:
	if not on_foot:
		return is_passable_cell(cx, cy)
	if not in_bounds(cx, cy):
		return false
	var i := idx(cx, cy)
	return terrain[i] != TERRAIN_WATER and blocked[i] == 0

func is_passable_for(x: float, y: float, on_foot: bool) -> bool:
	return is_passable_cell_for(int(x / float(cell)), int(y / float(cell)), on_foot)

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

	# Averaging a sample with its counterparts under the map's symmetry makes
	# the field symmetric by construction: two samples for a mirrored duel,
	# four for a map in quarters. Every player then gets the same ground.
	var scale := 3.4 / float(cols)
	var quarters := four_fold()
	for cy in rows:
		for cx in cols:
			var images := symmetry_images(cx, cy)
			var coarse := 0.0
			var fine := 0.0
			for p in images:
				coarse += noise.fbm(float(p.x) * scale, float(p.y) * scale, 5)
				fine += detail.fbm(
					float(p.x) * scale * 4.0, float(p.y) * scale * 4.0, 3
				)
			var n := float(images.size())
			heights[idx(cx, cy)] = coarse / n + (fine / n - 0.5) * 0.09

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

	start_positions.clear()
	for p in symmetry_images(int(best["cx"]), int(best["cy"])):
		_carve_clearing(p.x, p.y, 9)
		start_positions.append({
			"cx": p.x, "cy": p.y,
			"x": (float(p.x) + 0.5) * float(cell),
			"y": (float(p.y) + 0.5) * float(cell),
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

	# Guaranteed spots around each start, copied to the other starts
	# automatically.
	var start: Dictionary = start_positions[0]
	var ring := [
		Vector2i(-4, -4), Vector2i(4, -4), Vector2i(-4, 4), Vector2i(4, 4),
		Vector2i(0, -7), Vector2i(7, 0), Vector2i(-7, 0), Vector2i(0, 7),
	]
	for offset in ring:
		var cx: int = int(start["cx"]) + offset.x
		var cy: int = int(start["cy"]) + offset.y
		var images := symmetry_images(cx, cy)
		if try_add.call(images[0].x, images[0].y, 1.0):
			for i in range(1, images.size()):
				try_add.call(images[i].x, images[i].y, 1.0)

	# Contested spots over the rest of the map, always in complete sets: a
	# spot that only some players can reach is an unearned advantage.
	var target := 40 if not four_fold() else 64
	var attempts := 0
	while spots.size() < target and attempts < 4000:
		attempts += 1
		var cx := rng.range_i(3, cols - 4)
		var cy := rng.range_i(3, rows - 4)
		# Skip the exact centre cell, which maps onto itself.
		if absf(float(cx) - centre_x) < 1.0 and absf(float(cy) - centre_y) < 1.0:
			continue
		var yield_value := 1.6 if rng.chance(0.22) else 1.0
		var before := spots.size()
		var images := symmetry_images(cx, cy)
		if not try_add.call(images[0].x, images[0].y, yield_value):
			continue
		var complete := true
		for i in range(1, images.size()):
			if not try_add.call(images[i].x, images[i].y, yield_value):
				complete = false
				break
		if not complete:
			spots.resize(before)  # keep the sets honest

	metal_spots = spots

## Guarantee every start is connected by land to the first, carving a corridor
## rather than rerolling the whole map.
func _ensure_connectivity() -> void:
	var a: Dictionary = start_positions[0]
	for i in range(1, start_positions.size()):
		_connect_to_first(a, start_positions[i])

	var reach := _flood_fill(int(a["cx"]), int(a["cy"]))
	_reachable = reach
	_prune_unreachable_spots(reach)


## Carve a corridor from `a` to `b` if there is not already a way. Pruning is
## left to the caller: with more than two starts, spots must not be discarded
## until every corridor has been cut.
func _connect_to_first(a: Dictionary, b: Dictionary) -> void:
	var reach := _flood_fill(int(a["cx"]), int(a["cy"]))
	if reach[idx(int(b["cx"]), int(b["cy"]))] == 1:
		return
	_carve_corridor(a, b)

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
