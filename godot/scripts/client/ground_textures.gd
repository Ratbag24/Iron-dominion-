class_name IdGroundTextures
extends RefCounted

## The ground's tiling materials, generated rather than shipped.
##
## Nothing in this project is a texture file; the terrain's grain came from a
## single procedural normal map, and the ground read as a smooth sheet of
## colour because that is what it was. These are proper albedo and normal
## pairs for grass, earth, rock, sand and the hive's creep, built at load time
## on a wrapping noise lattice so every one of them tiles without a seam.
##
## Everything is derived from one height field per material: the albedo is a
## palette ramp over it with detail layered on top, and the normal map is its
## slope. That is what keeps the two in step - a bright fleck is on a bump.

const SIZE: int = 256

## Height fields, one per material, shared between the albedo and normal
## passes. Built once; the textures are wrapped for the GPU by the caller.
var images: Dictionary = {}

var _rng: IdRng


func _init(seed_value: int = 0x6A0D51) -> void:
	_rng = IdRng.new(seed_value)
	_build_all()


func _build_all() -> void:
	var t0 := Time.get_ticks_msec()
	_material("grass", _grass_height(), _grass_albedo, 2.4)
	_material("earth", _earth_height(), _earth_albedo, 3.0)
	_material("rock", _rock_height(), _rock_albedo, 5.0)
	_material("sand", _sand_height(), _sand_albedo, 1.6)
	_material("creep", _creep_height(), _creep_albedo, 3.6)
	print("ground textures generated in %dms" % (Time.get_ticks_msec() - t0))


func _material(name: String, h: PackedFloat32Array, albedo_fn: Callable, strength: float) -> void:
	images[name + "_albedo"] = _albedo_image(h, albedo_fn)
	images[name + "_normal"] = _normal_image(h, strength)


# ------------------------------------------------------------- noise

## A wrapping lattice of random values. Every octave samples it at an integer
## multiple of the tile, so the result repeats exactly at the texture edge.
func _lattice(tiles: int) -> PackedFloat32Array:
	var out := PackedFloat32Array()
	out.resize(tiles * tiles)
	for i in out.size():
		out[i] = _rng.next()
	return out


static func _octave(lat: PackedFloat32Array, tiles: int, u: float, v: float, freq: float) -> float:
	var fx := u * float(tiles) * freq
	var fy := v * float(tiles) * freq
	var x0 := floori(fx)
	var y0 := floori(fy)
	var tx := fx - float(x0)
	var ty := fy - float(y0)
	tx = tx * tx * (3.0 - 2.0 * tx)
	ty = ty * ty * (3.0 - 2.0 * ty)
	var xa := posmod(x0, tiles)
	var xb := posmod(x0 + 1, tiles)
	var ya := posmod(y0, tiles) * tiles
	var yb := posmod(y0 + 1, tiles) * tiles
	var a := lat[ya + xa] + (lat[ya + xb] - lat[ya + xa]) * tx
	var b := lat[yb + xa] + (lat[yb + xb] - lat[yb + xa]) * tx
	return a + (b - a) * ty


## Layered wrapping noise in [0, 1]. `ridged` folds each octave about its
## middle, which turns soft blobs into creases: cracks in rock, veins in flesh.
func _fbm(lat: PackedFloat32Array, tiles: int, u: float, v: float, octaves: int, ridged: bool = false) -> float:
	var amp := 1.0
	var freq := 1.0
	var total := 0.0
	var norm := 0.0
	for _i in octaves:
		var s := _octave(lat, tiles, u, v, freq)
		if ridged:
			s = 1.0 - absf(s * 2.0 - 1.0)
			s *= s
		total += s * amp
		norm += amp
		amp *= 0.5
		freq *= 2.0
	return total / norm


func _field(fn: Callable) -> PackedFloat32Array:
	var h := PackedFloat32Array()
	h.resize(SIZE * SIZE)
	var inv := 1.0 / float(SIZE)
	for y in SIZE:
		var v := float(y) * inv
		var row := y * SIZE
		for x in SIZE:
			h[row + x] = fn.call(float(x) * inv, v)
	return h


# ---------------------------------------------------------- materials

func _grass_height() -> PackedFloat32Array:
	var broad := _lattice(4)
	var blades := _lattice(48)
	var clumps := _lattice(12)
	return _field(func(u: float, v: float) -> float:
		var b := _fbm(broad, 4, u, v, 3)
		var c := _fbm(clumps, 12, u, v, 2)
		# Blades: fine, directional, and only where the clumps are.
		var bl := _octave(blades, 48, u, v * 0.35, 1.0)
		return clampf(b * 0.45 + c * 0.35 + bl * 0.2 * (0.5 + c), 0.0, 1.0)
	)


func _grass_albedo(h: float, u: float, v: float) -> Color:
	var dry := smoothstep(0.55, 0.8, h)
	# Kept muted: the first pass rendered as a neon lawn under ACES tonemapping,
	# and real turf from the air is closer to olive than to lime.
	var green := Color(0.23, 0.33, 0.14)
	var straw := Color(0.42, 0.39, 0.2)
	var deep := Color(0.14, 0.22, 0.1)
	var c := deep.lerp(green, smoothstep(0.2, 0.55, h)).lerp(straw, dry * 0.6)
	return c * (0.9 + h * 0.18)


func _earth_height() -> PackedFloat32Array:
	var broad := _lattice(6)
	var grit := _lattice(40)
	var stones := _lattice(20)
	return _field(func(u: float, v: float) -> float:
		var b := _fbm(broad, 6, u, v, 3)
		var g := _fbm(grit, 40, u, v, 2)
		# Pebbles: the peaks of a sharp field, thresholded.
		var s := _octave(stones, 20, u, v, 1.0)
		var pebble := smoothstep(0.78, 0.9, s)
		return clampf(b * 0.55 + g * 0.3 + pebble * 0.4, 0.0, 1.0)
	)


func _earth_albedo(h: float, u: float, v: float) -> Color:
	var mud := Color(0.31, 0.22, 0.14)
	var dust := Color(0.5, 0.4, 0.27)
	var stone := Color(0.46, 0.44, 0.4)
	var c := mud.lerp(dust, smoothstep(0.25, 0.7, h))
	return c.lerp(stone, smoothstep(0.82, 0.95, h)) * (0.9 + h * 0.2)


func _rock_height() -> PackedFloat32Array:
	var mass := _lattice(5)
	var cracks := _lattice(9)
	var grain := _lattice(36)
	return _field(func(u: float, v: float) -> float:
		var m := _fbm(mass, 5, u, v, 3)
		var cr := _fbm(cracks, 9, u, v, 3, true)
		var g := _fbm(grain, 36, u, v, 2)
		# Strata: a slow band across the face, as sediment lays down.
		var band := 0.5 + 0.5 * sin((v * 7.0 + m * 1.5) * TAU)
		var hgt := m * 0.5 + (1.0 - cr) * 0.35 + g * 0.1 + band * 0.08
		return clampf(hgt, 0.0, 1.0)
	)


func _rock_albedo(h: float, u: float, v: float) -> Color:
	var dark := Color(0.17, 0.17, 0.19)
	var mid := Color(0.33, 0.32, 0.31)
	var light := Color(0.47, 0.45, 0.42)
	var c := dark.lerp(mid, smoothstep(0.2, 0.55, h)).lerp(light, smoothstep(0.6, 0.9, h))
	# A little warmth in the crevices, where earth collects.
	return c.lerp(Color(0.33, 0.27, 0.2), (1.0 - smoothstep(0.15, 0.4, h)) * 0.35)


func _sand_height() -> PackedFloat32Array:
	var ripples := _lattice(3)
	var grain := _lattice(52)
	return _field(func(u: float, v: float) -> float:
		var r := _fbm(ripples, 3, u, v, 2)
		var wave := 0.5 + 0.5 * sin((u * 9.0 + r * 2.2) * TAU)
		var g := _octave(grain, 52, u, v, 1.0)
		# Ripples are low: the sea bed shows through the water, and strong
		# ones turned the whole sea into stripes.
		return clampf(wave * 0.3 + g * 0.45 + r * 0.25, 0.0, 1.0)
	)


func _sand_albedo(h: float, u: float, v: float) -> Color:
	var wet := Color(0.42, 0.37, 0.27)
	var dry := Color(0.6, 0.54, 0.4)
	return wet.lerp(dry, smoothstep(0.3, 0.75, h)) * (0.92 + h * 0.14)


func _creep_height() -> PackedFloat32Array:
	var mass := _lattice(4)
	var veins := _lattice(7)
	var pustules := _lattice(16)
	return _field(func(u: float, v: float) -> float:
		var m := _fbm(mass, 4, u, v, 3)
		var vn := _fbm(veins, 7, u, v, 3, true)
		var p := _octave(pustules, 16, u, v, 1.0)
		var blister := smoothstep(0.72, 0.9, p)
		return clampf(m * 0.4 + vn * 0.4 + blister * 0.45, 0.0, 1.0)
	)


func _creep_albedo(h: float, u: float, v: float) -> Color:
	# Dark and wet rather than pink: the first pass read as a raspberry
	# stain from the air. The veins are narrow and the membrane between them
	# is what most of the surface is.
	var flesh := Color(0.16, 0.07, 0.09)
	var vein := Color(0.36, 0.55, 0.14)
	var membrane := Color(0.27, 0.13, 0.15)
	var c := flesh.lerp(membrane, smoothstep(0.25, 0.6, h))
	c = c.lerp(vein, smoothstep(0.72, 0.84, h) * 0.65)
	return c


# ----------------------------------------------------------- images

func _albedo_image(h: PackedFloat32Array, fn: Callable) -> Image:
	var img := Image.create(SIZE, SIZE, true, Image.FORMAT_RGBA8)
	var inv := 1.0 / float(SIZE)
	for y in SIZE:
		var row := y * SIZE
		for x in SIZE:
			var c: Color = fn.call(h[row + x], float(x) * inv, float(y) * inv)
			# Alpha carries the height, which the shader uses to shape the
			# edge of the creep and could use for height-based blending.
			c.a = h[row + x]
			img.set_pixel(x, y, c)
	img.generate_mipmaps()
	return img


func _normal_image(h: PackedFloat32Array, strength: float) -> Image:
	var img := Image.create(SIZE, SIZE, true, Image.FORMAT_RGB8)
	for y in SIZE:
		var ym := posmod(y - 1, SIZE) * SIZE
		var yp := posmod(y + 1, SIZE) * SIZE
		var row := y * SIZE
		for x in SIZE:
			var xm := posmod(x - 1, SIZE)
			var xp := posmod(x + 1, SIZE)
			var dx := (h[row + xp] - h[row + xm]) * strength
			var dy := (h[yp + x] - h[ym + x]) * strength
			var n := Vector3(-dx, -dy, 1.0).normalized()
			img.set_pixel(x, y, Color(n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5))
	img.generate_mipmaps()
	return img
