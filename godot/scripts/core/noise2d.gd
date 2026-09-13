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

static func _fade(t: float) -> float:
	return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)

func _dot_grad(gx: int, gy: int, dx: float, dy: float) -> float:
	var g: int = _perm[_perm[gx] + gy] & 255
	return _grad_x[g] * dx + _grad_y[g] * dy

func sample(x: float, y: float) -> float:
	var xi: int = int(floor(x)) & 255
	var yi: int = int(floor(y)) & 255
	var xf: float = x - floor(x)
	var yf: float = y - floor(y)
	var u: float = _fade(xf)
	var v: float = _fade(yf)
	var n00: float = _dot_grad(xi, yi, xf, yf)
	var n10: float = _dot_grad(xi + 1, yi, xf - 1.0, yf)
	var n01: float = _dot_grad(xi, yi + 1, xf, yf - 1.0)
	var n11: float = _dot_grad(xi + 1, yi + 1, xf - 1.0, yf - 1.0)
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
