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
## World units per repeat of the detail normal map.
const DETAIL_TILE: float = 110.0
const NORMAL_MAP_SIZE: int = 256
const NORMAL_MAP_TILES: int = 6

## The simulation map this heightfield was resampled from.
var map: IdGameMap:
	get: return _map

var _map: IdGameMap
var _detail: IdNoise2D
var _render_cols: int = 0
var _render_rows: int = 0
var _render_cell: float = 0.0
var _render_heights: PackedFloat32Array = PackedFloat32Array()
var _cell_f: float = 16.0

## One colour per simulation cell, computed once. The mesh is four times finer
## than the simulation grid and blends four cells per vertex, so without this
## every cell's colour is worked out sixteen times over.
var _cell_colours: PackedColorArray = PackedColorArray()

## Per-cell surface-grain weight; see _build_fade.
var _fade: PackedFloat32Array = PackedFloat32Array()

## Per-cell material weights for the ground shader: (earth, rock, sand, macro
## brightness). Grass is whatever the first three leave over. The colour table
## above is kept for the minimap, which is drawn flat and needs a colour.
var _cell_splat: PackedColorArray = PackedColorArray()

func _init(map: IdGameMap, scale: int = 2) -> void:
	_map = map
	_detail = IdNoise2D.new(DETAIL_SEED)
	_build_heightfield(scale)
	_build_cell_colours()

## The simulation heightfield sampled between cells.
##
## Written out longhand rather than with clamp helpers: this runs five times
## per render vertex, a few million times per map, and each Callable invocation
## in GDScript costs more than the arithmetic around it.
func _bilinear_base(x: float, y: float) -> float:
	var cols := _map.cols
	var rows := _map.rows
	var fx := x / _cell_f - 0.5
	var fy := y / _cell_f - 0.5
	var x0 := int(floor(fx))
	var y0 := int(floor(fy))
	var tx := fx - float(x0)
	var ty := fy - float(y0)

	var xa := clampi(x0, 0, cols - 1)
	var xb := clampi(x0 + 1, 0, cols - 1)
	var ya := clampi(y0, 0, rows - 1) * cols
	var yb := clampi(y0 + 1, 0, rows - 1) * cols

	var h := _map.heights
	var h00 := h[ya + xa]
	var h10 := h[ya + xb]
	var h01 := h[yb + xa]
	var h11 := h[yb + xb]
	var a := h00 + (h10 - h00) * tx
	var b := h01 + (h11 - h01) * tx
	return a + (b - a) * ty

func _build_heightfield(scale: int) -> void:
	_render_cols = _map.cols * scale + 1
	_render_rows = _map.rows * scale + 1
	_render_cell = float(_map.cell) / float(scale)
	_cell_f = float(_map.cell)
	_render_heights.resize(_render_cols * _render_rows)

	var coarse := 0.085
	var fine := 0.032
	_build_fade()

	for j in _render_rows:
		var y := float(j) * _render_cell
		var row := j * _render_cols
		for i in _render_cols:
			var x := float(i) * _render_cell
			var base := _bilinear_base(x, y)
			var fade := _bilinear_fade(x, y)
			var a := _detail.fbm(x * 0.020, y * 0.020, 3) - 0.5
			var b := _detail.fbm(x * 0.085, y * 0.085, 2) - 0.5
			_render_heights[row + i] = base + (a * coarse + b * fine) * fade


## How much surface grain each simulation cell takes.
##
## Grain belongs on open ground: cliffs have shape of their own, and anything
## below the waterline would only poke through the surface. This varies at the
## scale of the terrain itself, not of the render mesh, so it is worked out
## once per simulation cell and interpolated - which is four fewer heightfield
## samples and two fewer smoothsteps on every one of the render vertices.
func _build_fade() -> void:
	var cols := _map.cols
	var rows := _map.rows
	var cell := _cell_f
	var water := _map.water_line
	_fade.resize(cols * rows)

	for cy in range(rows):
		var y := (float(cy) + 0.5) * cell
		var row := cy * cols
		for cx in range(cols):
			var x := (float(cx) + 0.5) * cell
			var base := _map.heights[row + cx]
			var dhx := _bilinear_base(x + cell, y) - _bilinear_base(x - cell, y)
			var dhy := _bilinear_base(x, y + cell) - _bilinear_base(x, y - cell)
			var slope := sqrt(dhx * dhx + dhy * dhy)
			var flatness := 1.0 - _smoothstep(0.02, 0.075, slope)
			var dry := _smoothstep(water - 0.01, water + 0.04, base)
			_fade[row + cx] = flatness * dry


func _bilinear_fade(x: float, y: float) -> float:
	var cols := _map.cols
	var rows := _map.rows
	var fx := x / _cell_f - 0.5
	var fy := y / _cell_f - 0.5
	var x0 := int(floor(fx))
	var y0 := int(floor(fy))
	var tx := fx - float(x0)
	var ty := fy - float(y0)

	var xa := clampi(x0, 0, cols - 1)
	var xb := clampi(x0 + 1, 0, cols - 1)
	var ya := clampi(y0, 0, rows - 1) * cols
	var yb := clampi(y0 + 1, 0, rows - 1) * cols

	var f00 := _fade[ya + xa]
	var f10 := _fade[ya + xb]
	var f01 := _fade[yb + xa]
	var f11 := _fade[yb + xb]
	var a := f00 + (f10 - f00) * tx
	var b := f01 + (f11 - f01) * tx
	return a + (b - a) * ty


static func _smoothstep(edge0: float, edge1: float, t: float) -> float:
	var k := clampf((t - edge0) / (edge1 - edge0), 0.0, 1.0)
	return k * k * (3.0 - 2.0 * k)

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

## Build the per-cell colour table. Called once, before anything samples it.
func _build_cell_colours() -> void:
	_cell_colours.resize(_map.cols * _map.rows)
	_cell_splat.resize(_map.cols * _map.rows)
	for cy in range(_map.rows):
		var row := cy * _map.cols
		for cx in range(_map.cols):
			_cell_colours[row + cx] = _terrain_colour(cx, cy)
			_cell_splat[row + cx] = _terrain_splat(cx, cy)


## What the ground is made of at this cell, for the shader to paint.
##
## The simulation only knows land, water and rock. What the eye needs is
## finer than that: earth on slopes and along the shore, sand under the water
## line, rock climbing in as the ground rises towards the rock line, and a
## slow macro tint so a field is not one flat green.
func _terrain_splat(cx: int, cy: int) -> Color:
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

	var broad := _detail.fbm(float(cx) * 0.03, float(cy) * 0.03, 3)
	var patch := _detail.fbm(float(cx) * 0.11 + 40.0, float(cy) * 0.11, 2)

	var earth := 0.0
	var rock := 0.0
	var sand := 0.0
	var water := _map.water_line
	var rock_line := _map.rock_line
	if t == IdGameMap.TERRAIN_WATER:
		# The bed: sand near the shore, darker earth further out.
		var depth := clampf((water - h) * 3.4, 0.0, 1.0)
		sand = 1.0 - depth * 0.6
		earth = depth * 0.6
	elif t == IdGameMap.TERRAIN_ROCK:
		rock = 1.0
		earth = (1.0 - clampf((h - rock_line) * 4.0, 0.0, 1.0)) * 0.25
	else:
		var rise := clampf((h - water) / maxf(0.01, rock_line - water), 0.0, 1.0)
		# Shore: a band of sand and earth just above the water line.
		var shore := 1.0 - smoothstep(0.0, 0.09, rise)
		sand = shore * 0.7
		earth = shore * 0.3
		# Slopes shed their grass; rock shows through as the ground climbs.
		earth = maxf(earth, steepness * 0.85)
		rock = smoothstep(0.62, 1.0, rise) * 0.7 + steepness * steepness * 0.5
		# Bare patches, so a plain is a plain and not a lawn. Kept sparse: at
		# the first strength the fields read as blotched.
		earth = maxf(earth, smoothstep(0.7, 0.84, patch) * 0.4 * (1.0 - rock))
	var macro := clampf(0.4 + broad * 0.45 + (patch - 0.5) * 0.08, 0.0, 1.0)
	return Color(clampf(earth, 0.0, 1.0), clampf(rock, 0.0, 1.0), clampf(sand, 0.0, 1.0), macro)


## Blend the four surrounding cells' material weights, as _sample_colour does
## for colour: the mesh is finer than the simulation grid.
func _sample_splat(x: float, z: float) -> Color:
	var cols := _map.cols
	var rows := _map.rows
	var fx := x / _cell_f - 0.5
	var fz := z / _cell_f - 0.5
	var x0 := int(floor(fx))
	var z0 := int(floor(fz))
	var tx := fx - float(x0)
	var tz := fz - float(z0)
	var xa := clampi(x0, 0, cols - 1)
	var xb := clampi(x0 + 1, 0, cols - 1)
	var za := clampi(z0, 0, rows - 1) * cols
	var zb := clampi(z0 + 1, 0, rows - 1) * cols
	var c00 := _cell_splat[za + xa]
	var c10 := _cell_splat[za + xb]
	var c01 := _cell_splat[zb + xa]
	var c11 := _cell_splat[zb + xb]
	return c00.lerp(c10, tx).lerp(c01.lerp(c11, tx), tz)


func _cell_colour(cx: int, cy: int) -> Color:
	return _cell_colours[
		clampi(cy, 0, _map.rows - 1) * _map.cols + clampi(cx, 0, _map.cols - 1)
	]


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
	var cols := _map.cols
	var rows := _map.rows
	var fx := x / _cell_f - 0.5
	var fz := z / _cell_f - 0.5
	var x0 := int(floor(fx))
	var z0 := int(floor(fz))
	var tx := fx - float(x0)
	var tz := fz - float(z0)

	var xa := clampi(x0, 0, cols - 1)
	var xb := clampi(x0 + 1, 0, cols - 1)
	var za := clampi(z0, 0, rows - 1) * cols
	var zb := clampi(z0 + 1, 0, rows - 1) * cols

	var c00 := _cell_colours[za + xa]
	var c10 := _cell_colours[za + xb]
	var c01 := _cell_colours[zb + xa]
	var c11 := _cell_colours[zb + xb]
	return c00.lerp(c10, tx).lerp(c01.lerp(c11, tx), tz)

## The ground as a single mesh, smooth-shaded, with material weights per vertex.
func build_mesh() -> ArrayMesh:
	var verts := PackedVector3Array()
	var colours := PackedColorArray()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	verts.resize(_render_cols * _render_rows)
	colours.resize(_render_cols * _render_rows)
	uvs.resize(_render_cols * _render_rows)

	for j in _render_rows:
		for i in _render_cols:
			var x := float(i) * _render_cell
			var z := float(j) * _render_cell
			var n := j * _render_cols + i
			verts[n] = Vector3(x, height_at(x, z), z)
			# COLOR is not a colour here: it is the ground shader's material
			# weights. The painted colour survives only on the minimap.
			colours[n] = _sample_splat(x, z)
			# UVs are world position over the tile size, so the detail normal
			# map repeats at a fixed scale regardless of map size.
			uvs[n] = Vector2(x / DETAIL_TILE, z / DETAIL_TILE)

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
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices

	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)

	# Godot can generate the normals for us from the finished surface.
	var st := SurfaceTool.new()
	st.create_from(mesh, 0)
	st.generate_normals()
	# A normal map needs a tangent basis, and the ground has no authored one.
	st.generate_tangents()
	return st.commit()

func water_level() -> float:
	return _map.water_line * HEIGHT_SCALE


## A small image of the whole map, for the minimap. Brightened a little,
## because the ground palette is tuned for a lit 3D surface and reads as mud
## when it is shown flat.
##
## Returns the Image rather than a texture: this is built on the loading
## thread, and wrapping it for the GPU is the caller's job on the main one.
func minimap_image(size: int = 192) -> Image:
	var img := Image.create(size, size, false, Image.FORMAT_RGB8)
	for y in range(size):
		var cy := mini(_map.rows - 1, int(float(y) / float(size) * _map.rows))
		for x in range(size):
			var cx := mini(_map.cols - 1, int(float(x) / float(size) * _map.cols))
			var c := _cell_colour(cx, cy)
			img.set_pixel(x, y, Color(
				minf(c.r * 1.45 + 0.03, 1.0),
				minf(c.g * 1.45 + 0.03, 1.0),
				minf(c.b * 1.45 + 0.03, 1.0)
			))
	return img


# ------------------------------------------------------ detail normal map

## A seamless procedural normal map for the ground.
##
## Without it the terrain reads as a smooth sheet of colour: the mesh itself
## only carries one vertex every eight world units, which is far too coarse to
## catch the light the way ground does. The lattice wraps, so every octave
## tiles and there is no seam where the texture repeats.
static func detail_normal_image() -> Image:
	if _normal_image != null:
		return _normal_image

	var rand := IdRng.new(0x5eed14)
	var tiles := NORMAL_MAP_TILES
	var lattice := PackedFloat32Array()
	lattice.resize(tiles * tiles)
	for i in range(lattice.size()):
		lattice[i] = rand.next()

	var size := NORMAL_MAP_SIZE
	var img := Image.create(size, size, false, Image.FORMAT_RGB8)
	var step := 1.0 / float(size)
	var strength := 2.6

	for y in range(size):
		for x in range(size):
			var u := float(x) / float(size)
			var v := float(y) / float(size)
			# Central differences give the slope; the wrapping lattice means
			# the samples either side of an edge come from the far side.
			var dx := (_detail_height(lattice, tiles, u + step, v)
				- _detail_height(lattice, tiles, u - step, v)) * strength
			var dy := (_detail_height(lattice, tiles, u, v + step)
				- _detail_height(lattice, tiles, u, v - step)) * strength
			var n := Vector3(-dx, -dy, 1.0).normalized()
			img.set_pixel(x, y, Color(
				n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5
			))

	_normal_image = img
	return img


static var _normal_image: Image = null


static func _detail_height(lattice: PackedFloat32Array, tiles: int, u: float, v: float) -> float:
	return (
		_detail_octave(lattice, tiles, u, v, 1.0) * 0.62
		+ _detail_octave(lattice, tiles, u, v, 3.0) * 0.26
		+ _detail_octave(lattice, tiles, u, v, 7.0) * 0.12
	)


## Value noise on a wrapping lattice, so every octave tiles seamlessly.
static func _detail_octave(
	lattice: PackedFloat32Array, tiles: int, u: float, v: float, freq: float
) -> float:
	var fx := u * float(tiles) * freq
	var fy := v * float(tiles) * freq
	var x0 := floori(fx)
	var y0 := floori(fy)
	var tx := _smoothstep_t(fx - float(x0))
	var ty := _smoothstep_t(fy - float(y0))

	var a00 := lattice[posmod(y0, tiles) * tiles + posmod(x0, tiles)]
	var a10 := lattice[posmod(y0, tiles) * tiles + posmod(x0 + 1, tiles)]
	var a01 := lattice[posmod(y0 + 1, tiles) * tiles + posmod(x0, tiles)]
	var a11 := lattice[posmod(y0 + 1, tiles) * tiles + posmod(x0 + 1, tiles)]

	var top := a00 + (a10 - a00) * tx
	var bot := a01 + (a11 - a01) * tx
	return top + (bot - top) * ty


static func _smoothstep_t(t: float) -> float:
	return t * t * (3.0 - 2.0 * t)
