class_name IdRtsCamera
extends Camera3D

## A top-down RTS camera: pan with the keyboard, the screen edge or a middle
## drag, zoom under the cursor with the wheel, rotate with a right drag while
## holding the modifier.
##
## Zooming keeps the ground point under the pointer fixed, which is what makes
## a strategy camera feel like it is attached to the map rather than to the
## screen.

const MIN_HEIGHT: float = 120.0
const MAX_HEIGHT: float = 2400.0
const EDGE_MARGIN: float = 6.0
const PAN_SPEED: float = 1.35      ## world units per second, per unit of height
const ZOOM_STEP: float = 0.12

var terrain: IdTerrainBuilder
var map_width: float = 3072.0
var map_height: float = 3072.0

## Ground point the camera looks at, and how it sits above it.
var focus: Vector3 = Vector3.ZERO
var distance: float = 700.0
var pitch: float = 0.92
var yaw: float = 0.0

var edge_scroll: bool = true

var _dragging: bool = false
var _rotating: bool = false
var _mouse_seen: bool = false


func setup(t: IdTerrainBuilder, centre: Vector2) -> void:
	terrain = t
	map_width = t.map.width
	map_height = t.map.height
	focus = Vector3(centre.x, t.height_at(centre.x, centre.y), centre.y)
	fov = 48.0
	far = 14000.0
	_apply()


func _apply() -> void:
	var horizontal: float = cos(pitch) * distance
	var offset := Vector3(
		sin(yaw) * horizontal,
		sin(pitch) * distance,
		cos(yaw) * horizontal
	)
	position = focus + offset
	look_at(focus, Vector3.UP)


func pan(dx: float, dz: float) -> void:
	# Pan along the camera's own axes so "up" is always away from the viewer,
	# whatever the yaw.
	var forward := Vector3(-sin(yaw), 0.0, -cos(yaw))
	var right := Vector3(cos(yaw), 0.0, -sin(yaw))
	focus += right * dx + forward * dz
	focus.x = clampf(focus.x, 0.0, map_width)
	focus.z = clampf(focus.z, 0.0, map_height)
	if terrain != null:
		focus.y = terrain.height_at(focus.x, focus.z)
	_apply()


## Ground position under a screen point, or the focus when the ray misses.
func ground_at(screen_pos: Vector2) -> Vector3:
	var origin := project_ray_origin(screen_pos)
	var dir := project_ray_normal(screen_pos)
	if absf(dir.y) < 1e-5:
		return focus
	# Intersect the plane through the focus first, then refine against the
	# heightfield so picking follows hills rather than a flat sheet.
	var t: float = (focus.y - origin.y) / dir.y
	if t < 0.0:
		return focus
	var hit := origin + dir * t
	if terrain != null:
		for _i in range(3):
			var ground: float = terrain.height_at(hit.x, hit.z)
			var t2: float = (ground - origin.y) / dir.y
			if t2 < 0.0:
				break
			hit = origin + dir * t2
	return hit


func zoom(steps: float, at_screen: Vector2) -> void:
	var before := ground_at(at_screen)
	distance = clampf(distance * pow(1.0 - ZOOM_STEP, steps), MIN_HEIGHT, MAX_HEIGHT)
	_apply()
	# Put the point that was under the cursor back under the cursor.
	var after := ground_at(at_screen)
	focus.x = clampf(focus.x + (before.x - after.x), 0.0, map_width)
	focus.z = clampf(focus.z + (before.z - after.z), 0.0, map_height)
	if terrain != null:
		focus.y = terrain.height_at(focus.x, focus.z)
	_apply()


func handle_input(event: InputEvent) -> bool:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			zoom(1.0, mb.position)
			return true
		if mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			zoom(-1.0, mb.position)
			return true
		if mb.button_index == MOUSE_BUTTON_MIDDLE:
			_dragging = mb.pressed
			return true
	elif event is InputEventMouseMotion:
		_mouse_seen = true
		var mm := event as InputEventMouseMotion
		if _dragging:
			var scale: float = distance / 700.0
			pan(-mm.relative.x * scale, -mm.relative.y * scale)
			return true
		if _rotating:
			yaw += mm.relative.x * 0.006
			pitch = clampf(pitch - mm.relative.y * 0.004, 0.35, 1.45)
			_apply()
			return true
	return false


func set_rotating(on: bool) -> void:
	_rotating = on


## Keyboard and edge scrolling. `viewport_size` bounds the edge test.
func update(dt: float, viewport_size: Vector2, mouse_pos: Vector2) -> void:
	var dx: float = 0.0
	var dz: float = 0.0

	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		dx -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		dx += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		dz += 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		dz -= 1.0

	# Only edge-scroll once the pointer has actually moved: a mouse position
	# that still reads (0, 0) at startup would drag the view into the corner.
	if edge_scroll and _mouse_seen and dx == 0.0 and dz == 0.0:
		if mouse_pos.x <= EDGE_MARGIN:
			dx -= 1.0
		elif mouse_pos.x >= viewport_size.x - EDGE_MARGIN:
			dx += 1.0
		if mouse_pos.y <= EDGE_MARGIN:
			dz += 1.0
		elif mouse_pos.y >= viewport_size.y - EDGE_MARGIN:
			dz -= 1.0

	if dx == 0.0 and dz == 0.0:
		return
	var speed: float = PAN_SPEED * distance * dt
	pan(dx * speed, dz * speed)
