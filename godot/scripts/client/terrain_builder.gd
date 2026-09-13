class_name IdTerrainBuilder
extends RefCounted

## Builds the ground mesh from a generated map.
##
## As in the reference build, rendering keeps a finer heightfield than the
## simulation does: the 16-unit simulation grid is right for pathing and far
## too coarse to look at. The simulation is untouched; this resamples it and
## folds in high-frequency noise for grain.

const HEIGHT_SCALE: float = 190.0
const DETAIL_SEED: int = 0x9E3D71

## The simulation map this heightfield was resampled from.
var map: IdGameMap:
	get: return _map

var _map: IdGameMap
var _detail: IdNoise2D
var _render_cols: int = 0
var _render_rows: int = 0
var _render_cell: float = 0.0
var _render_heights: PackedFloat32Array = PackedFloat32Array()

func _init(map: IdGameMap, scale: int = 2) -> void:
	_map = map
	_detail = IdNoise2D.new(DETAIL_SEED)
	_build_heightfield(scale)

func _bilinear_base(x: float, y: float) -> float:
	var c := float(_map.cell)
	var fx := x / c - 0.5
	var fy := y / c - 0.5
	var x0 := int(floor(fx))
	var y0 := int(floor(fy))
	var tx := fx - float(x0)
	var ty := fy - float(y0)
	var gx := func(i: int) -> int: return clampi(i, 0, _map.cols - 1)
	var gy := func(i: int) -> int: return clampi(i, 0, _map.rows - 1)
	var h00 := _map.heights[_map.idx(gx.call(x0), gy.call(y0))]
	var h10 := _map.heights[_map.idx(gx.call(x0 + 1), gy.call(y0))]
	var h01 := _map.heights[_map.idx(gx.call(x0), gy.call(y0 + 1))]
	var h11 := _map.heights[_map.idx(gx.call(x0 + 1), gy.call(y0 + 1))]
	var a := h00 + (h10 - h00) * tx
	var b := h01 + (h11 - h01) * tx
	return a + (b - a) * ty

func _build_heightfield(scale: int) -> void:
	_render_cols = _map.cols * scale + 1
	_render_rows = _map.rows * scale + 1
	_render_cell = float(_map.cell) / float(scale)
	_render_heights.resize(_render_cols * _render_rows)

	var coarse := 0.085
	var fine := 0.032
	var smoothstep_f := func(a: float, b: float, t: float) -> float:
		var k := clampf((t - a) / (b - a), 0.0, 1.0)
		return k * k * (3.0 - 2.0 * k)

	for j in _render_rows:
		for i in _render_cols:
			var x := float(i) * _render_cell
			var y := float(j) * _render_cell
			var base := _bilinear_base(x, y)
			# Grain belongs on open ground: cliffs have shape of their own, and
			# anything below the waterline would only poke through the surface.
			var slope := sqrt(
				pow(_bilinear_base(x + float(_map.cell), y) - _bilinear_base(x - float(_map.cell), y), 2.0)
				+ pow(_bilinear_base(x, y + float(_map.cell)) - _bilinear_base(x, y - float(_map.cell)), 2.0))
			var flatness: float = 1.0 - smoothstep_f.call(0.02, 0.075, slope)
			var dry: float = smoothstep_f.call(_map.water_line - 0.01, _map.water_line + 0.04, base)
			var fade: float = flatness * dry
			var a := _detail.fbm(x * 0.020, y * 0.020, 3) - 0.5
			var b := _detail.fbm(x * 0.085, y * 0.085, 2) - 0.5
			_render_heights[j * _render_cols + i] = base + (a * coarse + b * fine) * fade

## Surface height in world units, at the resolution the player actually sees.
func height_at(x: float, y: float) -> float:
	var fx := x / _render_cell
	var fy := y / _render_cell
	var x0 := clampi(int(floor(fx)), 0, _render_cols - 2)
	var y0 := clampi(int(floor(fy)), 0, _render_rows - 2)
	var tx := fx - float(x0)
	var ty := fy - float(y0)
	var i := y0 * _render_cols + x0
	var h00 := _render_heights[i]
	var h10 := _render_heights[i + 1]
	var h01 := _render_heights[i + _render_cols]
	var h11 := _render_heights[i + _render_cols + 1]
	var a := h00 + (h10 - h00) * tx
	var b := h01 + (h11 - h01) * tx
	return (a + (b - a) * ty) * HEIGHT_SCALE

func _terrain_colour(cx: int, cy: int) -> Color:
	var i := _map.idx(cx, cy)
	var t := _map.terrain[i]
	var h := _map.heights[i]

	var hx0 := _map.heights[_map.idx(maxi(0, cx - 1), cy)]
	var hx1 := _map.heights[_map.idx(mini(_map.cols - 1, cx + 1), cy)]
	var hy0 := _map.heights[_map.idx(cx, maxi(0, cy - 1))]
	var hy1 := _map.heights[_map.idx(cx, mini(_map.rows - 1, cy + 1))]
	var gx := (hx1 - hx0) * 0.5
	var gy := (hy1 - hy0) * 0.5
	var steepness := clampf(sqrt(gx * gx + gy * gy) * 22.0, 0.0, 1.0)
	var light_slope := clampf((-gx - gy) * 3.0, -0.4, 0.4)

	var broad := _detail.fbm(float(cx) * 0.045, float(cy) * 0.045, 2)
	var fine := _detail.fbm(float(cx) * 0.19, float(cy) * 0.19, 2)

	var r := 0.0
	var g := 0.0
	var b := 0.0
	if t == IdGameMap.TERRAIN_WATER:
		var d := clampf((_map.water_line - h) * 3.4, 0.0, 1.0)
		r = 0.050 + (1.0 - d) * 0.035 - d * 0.02
		g = 0.135 + (1.0 - d) * 0.070 - d * 0.05
		b = 0.245 + (1.0 - d) * 0.045 - d * 0.09
	elif t == IdGameMap.TERRAIN_ROCK:
		var tt := clampf((h - _map.rock_line) * 3.2, 0.0, 1.0)
		var tint := 0.93 + fine * 0.14
		r = (0.285 + tt * 0.26) * tint
		g = (0.285 + tt * 0.26) * tint
		b = (0.315 + tt * 0.27) * tint
	else:
		var tt2 := clampf((h - _map.water_line) / maxf(0.01, _map.rock_line - _map.water_line), 0.0, 1.0)
		var e := pow(tt2, 2.1)
		var lr := 0.112 + e * 0.215
		var lg := 0.168 + e * 0.170
		var lb := 0.082 + e * 0.108
		var patch := (broad - 0.5) * 0.055 + (fine - 0.5) * 0.022
		lr += patch * 1.05
		lg += patch * 0.85
		lb += patch * 0.5
		# Exposed earth on slopes.
		r = lr + (0.205 - lr) * steepness
		g = lg + (0.152 - lg) * steepness
		b = lb + (0.104 - lb) * steepness

	var shade := 1.0 + light_slope * 0.22
	return Color(clampf(r * shade, 0, 1), clampf(g * shade, 0, 1), clampf(b * shade, 0, 1))

## Blend the four surrounding cell colours.
##
## The mesh is finer than the simulation grid, so taking the nearest cell's
## colour leaves visible 16-unit steps wherever the ground changes type. This
## interpolates between neighbours instead, which softens those boundaries into
## a gradient without touching the terrain classification itself.
func _sample_colour(x: float, z: float) -> Color:
	var c := float(_map.cell)
	var fx := x / c - 0.5
	var fz := z / c - 0.5
	var x0 := int(floor(fx))
	var z0 := int(floor(fz))
	var tx := fx - float(x0)
	var tz := fz - float(z0)
	var gx := func(i: int) -> int: return clampi(i, 0, _map.cols - 1)
	var gz := func(i: int) -> int: return clampi(i, 0, _map.rows - 1)
	var c00 := _terrain_colour(gx.call(x0), gz.call(z0))
	var c10 := _terrain_colour(gx.call(x0 + 1), gz.call(z0))
	var c01 := _terrain_colour(gx.call(x0), gz.call(z0 + 1))
	var c11 := _terrain_colour(gx.call(x0 + 1), gz.call(z0 + 1))
	return c00.lerp(c10, tx).lerp(c01.lerp(c11, tx), tz)

## The ground as a single mesh, vertex-coloured and smooth-shaded.
func build_mesh() -> ArrayMesh:
	var verts := PackedVector3Array()
	var colours := PackedColorArray()
	var indices := PackedInt32Array()
	verts.resize(_render_cols * _render_rows)
	colours.resize(_render_cols * _render_rows)

	for j in _render_rows:
		for i in _render_cols:
			var x := float(i) * _render_cell
			var z := float(j) * _render_cell
			var n := j * _render_cols + i
			verts[n] = Vector3(x, height_at(x, z), z)
			colours[n] = _sample_colour(x, z)

	# Godot treats clockwise-as-seen-from-the-front as the front face, which is
	# the opposite of the OpenGL and Three.js convention. Wound the other way
	# round, the whole ground faces downwards and is culled away - the mesh is
	# entirely correct and simply invisible.
	for j in _render_rows - 1:
		for i in _render_cols - 1:
			var a := j * _render_cols + i
			var b := a + 1
			var c := a + _render_cols
			var d := c + 1
			indices.append_array([a, b, c, b, d, c])

	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_COLOR] = colours
	arrays[Mesh.ARRAY_INDEX] = indices

	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)

	# Godot can generate the normals for us from the finished surface.
	var st := SurfaceTool.new()
	st.create_from(mesh, 0)
	st.generate_normals()
	return st.commit()

func water_level() -> float:
	return _map.water_line * HEIGHT_SCALE
