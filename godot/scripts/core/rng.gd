class_name IdRng
extends RefCounted

## Seeded pseudo-random number generator and value noise.
##
## This is a deliberate reimplementation of the JavaScript original rather than
## a use of Godot's RandomNumberGenerator. Map generation has to produce
## identical terrain from the same seed in both builds, which means the bit
## pattern of the generator matters, not just its statistical quality.
##
## The original is mulberry32, which works on unsigned 32-bit integers.
## GDScript integers are signed 64-bit, so every step masks back to 32 bits
## and Math.imul is reproduced explicitly.

const MASK: int = 0xFFFFFFFF

var _state: int = 0

func _init(seed_value: int = 0) -> void:
	_state = seed_value & MASK

## 32-bit integer multiply with wraparound, matching JavaScript's Math.imul.
static func imul(a: int, b: int) -> int:
	var al: int = a & 0xFFFF
	var ah: int = (a >> 16) & 0xFFFF
	var bl: int = b & 0xFFFF
	var bh: int = (b >> 16) & 0xFFFF
	# The high halves only contribute to the top 16 bits, which then wrap away.
	var lo: int = al * bl
	var mid: int = ((al * bh) + (ah * bl)) & 0xFFFF
	return (lo + (mid << 16)) & MASK

## Next value in [0, 1), matching the JavaScript stream exactly.
##
## The original reads:
##     t = Math.imul(a ^ (a >>> 15), 1 | a);
##     t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
## That trailing `^ t` refers to t's value *before* the assignment, which is
## easy to misread as the state. Keeping the two apart by name avoids it.
func next() -> float:
	_state = (_state + 0x6D2B79F5) & MASK
	var t0: int = imul(_state ^ (_state >> 15), 1 | _state)
	var t1: int = ((t0 + imul(t0 ^ (t0 >> 7), 61 | t0)) & MASK) ^ t0
	var out: int = (t1 ^ (t1 >> 14)) & MASK
	return float(out) / 4294967296.0

func range_f(lo: float, hi: float) -> float:
	return lo + next() * (hi - lo)

func range_i(lo: int, hi: int) -> int:
	return lo + int(floor(next() * float(hi - lo + 1)))

func chance(p: float) -> bool:
	return next() < p
