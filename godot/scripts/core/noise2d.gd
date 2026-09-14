class_name IdNoise2D
extends RefCounted

## Gradient noise on a shuffled lattice, reproducing the JavaScript original.
##
## Godot ships FastNoiseLite, which is better noise - but different noise. The
## terrain has to match the reference build exactly, so this mirrors the
## original's permutation shuffle and gradient table instead.

var _perm: PackedInt32Array = PackedInt32Array()
var _grad_x: PackedFloat64Array = PackedFloat64Array()
var _grad_y: PackedFloat64Array = PackedFloat64Array()

const SIZE: int = 256

func _init(seed_value: int) -> void:
	var rng := IdRng.new(seed_value)
	_perm.resize(SIZE * 2)
	for i in SIZE:
		_perm[i] = i
	# Fisher-Yates, drawing in the same order as the original.
	for i in range(SIZE - 1, 0, -1):
		var j: int = rng.range_i(0, i)
		var t: int = _perm[i]
		_perm[i] = _perm[j]
		_perm[j] = t
	for i in SIZE:
		_perm[SIZE + i] = _perm[i]

	_grad_x.resize(SIZE)
	_grad_y.resize(SIZE)
	for i in SIZE:
		var a: float = (float(i) / float(SIZE)) * TAU
		_grad_x[i] = cos(a)
		_grad_y[i] = sin(a)

## One octave of gradient noise.
##
## The fade curve and the four gradient dot products are written out inline
## rather than as helpers. Terrain generation calls this the better part of a
## million times, and at that volume GDScript spends more on the five method
## calls this would otherwise make than on the arithmetic inside them.
func sample(x: float, y: float) -> float:
	var fx: float = floor(x)
	var fy: float = floor(y)
	var xi: int = int(fx) & 255
	var yi: int = int(fy) & 255
	var xf: float = x - fx
	var yf: float = y - fy

	var u: float = xf * xf * xf * (xf * (xf * 6.0 - 15.0) + 10.0)
	var v: float = yf * yf * yf * (yf * (yf * 6.0 - 15.0) + 10.0)

	var p := _perm
	var row0: int = p[xi]
	var row1: int = p[xi + 1]
	var g00: int = p[row0 + yi] & 255
	var g10: int = p[row1 + yi] & 255
	var g01: int = p[row0 + yi + 1] & 255
	var g11: int = p[row1 + yi + 1] & 255

	var gx := _grad_x
	var gy := _grad_y
	var xf1: float = xf - 1.0
	var yf1: float = yf - 1.0
	var n00: float = gx[g00] * xf + gy[g00] * yf
	var n10: float = gx[g10] * xf1 + gy[g10] * yf
	var n01: float = gx[g01] * xf + gy[g01] * yf1
	var n11: float = gx[g11] * xf1 + gy[g11] * yf1

	var nx0: float = n00 + u * (n10 - n00)
	var nx1: float = n01 + u * (n11 - n01)
	return nx0 + v * (nx1 - nx0)

## Layered noise in [0, 1].
func fbm(x: float, y: float, octaves: int = 4, lacunarity: float = 2.0, gain: float = 0.5) -> float:
	var amp: float = 1.0
	var freq: float = 1.0
	var total: float = 0.0
	var norm: float = 0.0
	for _i in octaves:
		total += sample(x * freq, y * freq) * amp
		norm += amp
		amp *= gain
		freq *= lacunarity
	return total / norm * 0.5 + 0.5
