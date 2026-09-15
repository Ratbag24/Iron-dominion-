class_name IdFogMap
extends RefCounted

## Fog of war and radar.
##
## Three states per cell: unexplored, explored (terrain remembered, units not
## shown), and currently visible. Radar coverage reveals moving contacts as
## blips without identifying them, which is how BAR handles radar.

var cell: int = 32
var cols: int = 0
var rows: int = 0
var explored: PackedByteArray = PackedByteArray()
var visible_cells: PackedByteArray = PackedByteArray()
var radar: PackedByteArray = PackedByteArray()
## Row spans queued by add_circle, each packed as row << 24 | x0 << 12 | x1,
## so one native sort groups them by row and a single pass can merge them.
var _spans: PackedInt32Array = PackedInt32Array()

## Last known enemy structures, keyed by entity id.
var memory: Dictionary = {}
var version: int = 0


func _init(game_map: IdGameMap, cell_size: int = 32) -> void:
	cell = cell_size
	cols = ceili(float(game_map.width) / float(cell_size))
	rows = ceili(float(game_map.height) / float(cell_size))
	var count: int = cols * rows
	explored.resize(count)
	visible_cells.resize(count)
	radar.resize(count)


func begin_frame() -> void:
	visible_cells.fill(0)
	radar.fill(0)
	version += 1


func _clamp_col(c: int) -> int:
	return clampi(c, 0, cols - 1)


func _clamp_row(r: int) -> int:
	return clampi(r, 0, rows - 1)


func reveal_circle(x: float, y: float, radius: float) -> void:
	var cs: float = float(cell)
	var r: float = radius / cs
	var cx: float = x / cs
	var cy: float = y / cs
	var min_x: int = _clamp_col(floori(cx - r))
	var max_x: int = _clamp_col(ceili(cx + r))
	var min_y: int = _clamp_row(floori(cy - r))
	var max_y: int = _clamp_row(ceili(cy + r))
	var r2: float = r * r
	for gy in range(min_y, max_y + 1):
		var dy: float = gy + 0.5 - cy
		var row: int = gy * cols
		for gx in range(min_x, max_x + 1):
			var dx: float = gx + 0.5 - cx
			if dx * dx + dy * dy > r2:
				continue
			var i: int = row + gx
			visible_cells[i] = 1
			explored[i] = 1


## Batched reveals: queue discs with add_circle, then write them once with
## end_batch. An army is a clump, and forty units on the same few cells
## stamping the same disc forty times was the largest cost in the tick at
## scale. Merging the discs into row spans first means each revealed cell is
## written once however many units can see it. The cells revealed are
## exactly those reveal_circle would reveal for the same discs.
func begin_batch() -> void:
	_spans.clear()


func add_circle(x: float, y: float, radius: float) -> void:
	var cs: float = float(cell)
	var r: float = radius / cs
	var cx: float = x / cs
	var cy: float = y / cs
	var min_y: int = _clamp_row(floori(cy - r))
	var max_y: int = _clamp_row(ceili(cy + r))
	var r2: float = r * r
	var last: int = cols - 1
	for gy in range(min_y, max_y + 1):
		var dy: float = gy + 0.5 - cy
		var rem: float = r2 - dy * dy
		if rem < 0.0:
			continue
		# A cell is in the disc when (gx + 0.5 - cx)^2 <= rem, so the row's
		# run is the integers within half of cx - 0.5.
		var half: float = sqrt(rem)
		var x0: int = ceili(cx - 0.5 - half)
		var x1: int = floori(cx - 0.5 + half)
		if x1 < 0 or x0 > last or x1 < x0:
			continue
		x0 = maxi(x0, 0)
		x1 = mini(x1, last)
		_spans.append((gy << 24) | (x0 << 12) | x1)


func end_batch() -> void:
	_spans.sort()
	var n: int = _spans.size()
	var i: int = 0
	while i < n:
		var s: int = _spans[i]
		var row: int = s >> 24
		var x0: int = (s >> 12) & 0xFFF
		var x1: int = s & 0xFFF
		i += 1
		# Swallow every later span on this row that touches or overlaps.
		while i < n:
			var t: int = _spans[i]
			if (t >> 24) != row or ((t >> 12) & 0xFFF) > x1 + 1:
				break
			var e: int = t & 0xFFF
			if e > x1:
				x1 = e
			i += 1
		var base: int = row * cols
		for gx in range(x0, x1 + 1):
			visible_cells[base + gx] = 1
			explored[base + gx] = 1


func reveal_radar(x: float, y: float, radius: float) -> void:
	var cs: float = float(cell)
	var r: float = radius / cs
	var cx: float = x / cs
	var cy: float = y / cs
	var min_x: int = _clamp_col(floori(cx - r))
	var max_x: int = _clamp_col(ceili(cx + r))
	var min_y: int = _clamp_row(floori(cy - r))
	var max_y: int = _clamp_row(ceili(cy + r))
	var r2: float = r * r
	for gy in range(min_y, max_y + 1):
		var dy: float = gy + 0.5 - cy
		var row: int = gy * cols
		for gx in range(min_x, max_x + 1):
			var dx: float = gx + 0.5 - cx
			if dx * dx + dy * dy > r2:
				continue
			radar[row + gx] = 1


func _index(x: float, y: float) -> int:
	var gx: int = _clamp_col(int(x / cell))
	var gy: int = _clamp_row(int(y / cell))
	return gy * cols + gx


func is_visible_at(x: float, y: float) -> bool:
	return visible_cells[_index(x, y)] == 1


func is_explored(x: float, y: float) -> bool:
	return explored[_index(x, y)] == 1


func has_radar(x: float, y: float) -> bool:
	return radar[_index(x, y)] == 1


## Remember an enemy structure so it stays drawn as a ghost under fog.
func remember(e: IdEntity) -> void:
	memory[e.id] = {
		"id": e.id,
		"def_id": e.def_id,
		"x": e.x,
		"y": e.y,
		"player": e.player,
		"faction": e.def.get("faction", ""),
		"footprint": int(e.def.get("footprint", 0)),
		"radius": e.radius,
		"heading": e.heading,
	}


## Drop remembered structures we can now see are gone.
func forget_gone(live_ids: Dictionary) -> void:
	var stale: Array = []
	for id in memory:
		if live_ids.has(id):
			continue
		var mem: Dictionary = memory[id]
		if is_visible_at(mem["x"], mem["y"]):
			stale.append(id)
	for id in stale:
		memory.erase(id)


func reveal_all() -> void:
	explored.fill(1)
	visible_cells.fill(1)
