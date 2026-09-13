class_name IdMath

## Small maths helpers shared by the simulation. Godot has most of these on
## Vector2, but the simulation keeps positions as loose floats so it never
## allocates in the tick, so they live here as free functions.

const TAU_F: float = TAU


static func dist2(ax: float, ay: float, bx: float, by: float) -> float:
	var dx: float = bx - ax
	var dy: float = by - ay
	return dx * dx + dy * dy


static func dist(ax: float, ay: float, bx: float, by: float) -> float:
	return sqrt(dist2(ax, ay, bx, by))


## Shortest signed angular difference from `a` to `b`, in (-PI, PI].
static func angle_delta(a: float, b: float) -> float:
	var d: float = fmod(b - a, TAU_F)
	if d > PI:
		d -= TAU_F
	if d < -PI:
		d += TAU_F
	return d


## Rotate `from` towards `to` by at most `max_step` radians.
static func turn_towards(from: float, to: float, max_step: float) -> float:
	var d: float = angle_delta(from, to)
	if absf(d) <= max_step:
		return to
	return from + signf(d) * max_step


static func normalize_angle(a: float) -> float:
	var v: float = fmod(a, TAU_F)
	if v < 0.0:
		v += TAU_F
	return v


## Solve for the lead position needed to hit a unit moving at constant
## velocity with a projectile of a fixed speed. Falls back to the target's
## current position when no solution exists.
static func intercept_point(
	sx: float, sy: float, tx: float, ty: float,
	tvx: float, tvy: float, speed: float
) -> Vector2:
	var here := Vector2(tx, ty)
	if speed <= 0.0:
		return here
	var dx: float = tx - sx
	var dy: float = ty - sy
	var a: float = tvx * tvx + tvy * tvy - speed * speed
	var b: float = 2.0 * (dx * tvx + dy * tvy)
	var c: float = dx * dx + dy * dy
	var t: float
	if absf(a) < 1e-6:
		if absf(b) < 1e-6:
			return here
		t = -c / b
	else:
		var disc: float = b * b - 4.0 * a * c
		if disc < 0.0:
			return here
		var root: float = sqrt(disc)
		var t1: float = (-b + root) / (2.0 * a)
		var t2: float = (-b - root) / (2.0 * a)
		t = minf(INF if t1 < 0.0 else t1, INF if t2 < 0.0 else t2)
	if not is_finite(t) or t < 0.0:
		return here
	return Vector2(tx + tvx * t, ty + tvy * t)


## Format a number for the resource readouts: 1234 -> "1.2k".
static func short_num(v: float) -> String:
	var a: float = absf(v)
	if a >= 10000.0:
		return "%.0fk" % (v / 1000.0)
	if a >= 1000.0:
		return "%.1fk" % (v / 1000.0)
	return "%.0f" % v
