class_name IdSpatialGrid
extends RefCounted

## Uniform spatial hash used for neighbour queries (target acquisition, unit
## separation, splash damage, selection). Rebuilt every simulation tick.

var cell_size: int = 96
var cols: int = 0
var rows: int = 0
var _cells: Array = []


func _init(width: int, height: int, size: int = 96) -> void:
	cell_size = size
	cols = ceili(float(width) / float(size))
	rows = ceili(float(height) / float(size))
	_cells.resize(cols * rows)
	for i in range(_cells.size()):
		_cells[i] = []


func clear() -> void:
	for i in range(_cells.size()):
		var cell: Array = _cells[i]
		if not cell.is_empty():
			cell.clear()


func _index(x: float, y: float) -> int:
	var cx: int = clampi(int(x / cell_size), 0, cols - 1)
	var cy: int = clampi(int(y / cell_size), 0, rows - 1)
	return cy * cols + cx


func insert(ent: IdEntity) -> void:
	_cells[_index(ent.x, ent.y)].append(ent)


## Collect every entity whose cell overlaps the radius around (x, y). The
## caller passes its own array so the hot paths do not allocate.
func query(x: float, y: float, radius: float, out: Array) -> Array:
	out.clear()
	var cs: float = float(cell_size)
	var min_x: int = maxi(int((x - radius) / cs), 0)
	var max_x: int = mini(int((x + radius) / cs), cols - 1)
	var min_y: int = maxi(int((y - radius) / cs), 0)
	var max_y: int = mini(int((y + radius) / cs), rows - 1)
	for cy in range(min_y, max_y + 1):
		var row: int = cy * cols
		for cx in range(min_x, max_x + 1):
			var cell: Array = _cells[row + cx]
			for i in range(cell.size()):
				out.append(cell[i])
	return out
