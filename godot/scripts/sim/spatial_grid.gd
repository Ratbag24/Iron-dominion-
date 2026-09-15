class_name IdSpatialGrid
extends RefCounted

## Uniform spatial hash used for neighbour queries (target acquisition, unit
## separation, splash damage, selection). Rebuilt every simulation tick.

var cell_size: int = 96
var cols: int = 0
var rows: int = 0
var _cells: Array = []
## The same entities bucketed by owning player, so a search for enemies can
## skip its own side's cells entirely. Target acquisition at scale spent most
## of its time rejecting friends; this rejects them by not visiting them.
var _by_player: Array = []
var _players: int = 0


func _init(width: int, height: int, size: int = 96, players: int = 2) -> void:
	cell_size = size
	cols = ceili(float(width) / float(size))
	rows = ceili(float(height) / float(size))
	_players = maxi(players, 1)
	_cells.resize(cols * rows)
	for i in range(_cells.size()):
		_cells[i] = []
	_by_player.resize(_players)
	for pi in _players:
		var arr: Array = []
		arr.resize(cols * rows)
		for i in range(arr.size()):
			arr[i] = []
		_by_player[pi] = arr


func clear() -> void:
	for i in range(_cells.size()):
		var cell: Array = _cells[i]
		if not cell.is_empty():
			cell.clear()
	for pi in _players:
		var arr: Array = _by_player[pi]
		for i in range(arr.size()):
			var cell: Array = arr[i]
			if not cell.is_empty():
				cell.clear()


func _index(x: float, y: float) -> int:
	var cx: int = clampi(int(x / cell_size), 0, cols - 1)
	var cy: int = clampi(int(y / cell_size), 0, rows - 1)
	return cy * cols + cx


func insert(ent: IdEntity) -> void:
	var i: int = _index(ent.x, ent.y)
	_cells[i].append(ent)
	if ent.player >= 0 and ent.player < _players:
		_by_player[ent.player][i].append(ent)


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
			# One engine call per cell rather than one per entity. Appending
			# element by element was the single largest cost in the tick at
			# scale: this loop runs for every unit, every tick, for both
			# separation and target acquisition.
			out.append_array(_cells[row + cx])
	return out


## As query, but only entities owned by players other than `allies` - the
## caller's own team, as a list of player indices to leave out.
func query_enemies(x: float, y: float, radius: float, allies: PackedInt32Array, out: Array) -> Array:
	out.clear()
	var cs: float = float(cell_size)
	var min_x: int = maxi(int((x - radius) / cs), 0)
	var max_x: int = mini(int((x + radius) / cs), cols - 1)
	var min_y: int = maxi(int((y - radius) / cs), 0)
	var max_y: int = mini(int((y + radius) / cs), rows - 1)
	for pi in _players:
		if allies.has(pi):
			continue
		var arr: Array = _by_player[pi]
		for cy in range(min_y, max_y + 1):
			var row: int = cy * cols
			for cx in range(min_x, max_x + 1):
				out.append_array(arr[row + cx])
	return out
