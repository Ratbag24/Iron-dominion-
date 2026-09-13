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
