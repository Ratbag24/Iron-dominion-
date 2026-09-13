class_name IdEffectsView
extends Node3D

## Draws everything transient: shots in flight, muzzle flashes, explosions and
## nanolathe beams.
##
## All of it is immediate-mode. The simulation produces a list of events each
## tick and the projectiles it is already tracking; this rebuilds the geometry
## from that every frame rather than keeping a parallel set of nodes alive,
## because nothing here survives long enough to be worth the bookkeeping.
##
## The effects list is the one piece of world state written for the view
## rather than by it, and the only thing here that touches the world is asking
## it to forget events too old to draw.

const EFFECT_LIFE: float = 0.55      ## seconds an explosion or flash is drawn
const BEAM_LIFE: float = 0.12        ## nanolathe beams are refreshed constantly
const TRACER_LENGTH: float = 26.0

var world: IdWorld
var terrain: IdTerrainBuilder
var viewer: int = 0

var _shots: MeshInstance3D
var _flashes: MeshInstance3D
var _shot_mesh: ImmediateMesh
var _flash_mesh: ImmediateMesh


func setup(w: IdWorld, t: IdTerrainBuilder, viewer_index: int = 0) -> void:
	world = w
	terrain = t
	viewer = viewer_index

	_shot_mesh = ImmediateMesh.new()
	_shots = MeshInstance3D.new()
	_shots.name = "Shots"
	_shots.mesh = _shot_mesh
	_shots.material_override = _additive_material()
	_shots.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_shots)

	_flash_mesh = ImmediateMesh.new()
	_flashes = MeshInstance3D.new()
	_flashes.name = "Flashes"
	_flashes.mesh = _flash_mesh
	_flashes.material_override = _additive_material()
	_flashes.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_flashes)


func _additive_material() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.no_depth_test = false
	return mat


func sync() -> void:
	_draw_shots()
	_draw_effects()


func _visible_at(x: float, y: float) -> bool:
	if viewer < 0:
		return true
	return world.fog[viewer].is_visible_at(x, y)


func _ground(x: float, y: float) -> float:
	return terrain.height_at(x, y)


# ------------------------------------------------------------------- shots

func _draw_shots() -> void:
	_shot_mesh.clear_surfaces()
	if world.projectiles.is_empty():
		return
	_shot_mesh.surface_begin(Mesh.PRIMITIVE_LINES)
	var drawn := 0
	for p in world.projectiles:
		var x: float = p["x"]
		var y: float = p["y"]
		if not _visible_at(x, y):
			continue
		var colour := Color(p["color"])
		var head := Vector3(x, _ground(x, y) + 10.0 + float(p["z"]), y)

		# Trail back along the direction of travel. Arcing shells carry their
		# own height, so the tail is taken from the previous position rather
		# than from the velocity.
		var tail: Vector3
		var kind: String = p["kind"]
		if kind == "arty" or kind == "plasma":
			var px: float = p["px"]
			var py: float = p["py"]
			tail = Vector3(px, _ground(px, py) + 10.0 + float(p["z"]), py)
		else:
			var speed: float = maxf(float(p["speed"]), 1.0)
			var back: float = TRACER_LENGTH / speed
			tail = head - Vector3(float(p["vx"]) * back, 0.0, float(p["vy"]) * back)

		_shot_mesh.surface_set_color(colour)
		_shot_mesh.surface_add_vertex(tail)
		_shot_mesh.surface_set_color(Color(colour.r, colour.g, colour.b, 0.15))
		_shot_mesh.surface_add_vertex(head)
		drawn += 1
	_shot_mesh.surface_end()
	if drawn == 0:
		_shot_mesh.clear_surfaces()


# ----------------------------------------------------------------- effects

func _draw_effects() -> void:
	_flash_mesh.clear_surfaces()
	if world.effects.is_empty():
		return

	# Drop events old enough that nothing will draw them again.
	world.prune_effects(EFFECT_LIFE)
	var now: float = world.time
	var keep: Array[Dictionary] = world.effects
	if keep.is_empty():
		return

	_flash_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	var drawn := 0
	for fx in keep:
		var age: float = now - float(fx["t"])
		var kind: String = fx["type"]
		match kind:
			"explosion":
				drawn += _explosion(fx, age)
			"impact", "muzzle":
				drawn += _spark(fx, age)
			"nanolathe":
				drawn += _beam(fx, age)
			"buildStart", "buildDone", "unitDone":
				drawn += _ring(fx, age)
	_flash_mesh.surface_end()
	if drawn == 0:
		_flash_mesh.clear_surfaces()


func _explosion(fx: Dictionary, age: float) -> int:
	var x: float = fx["x"]
	var y: float = fx["y"]
	if not _visible_at(x, y):
		return 0
	var t: float = clampf(age / EFFECT_LIFE, 0.0, 1.0)
	var size: float = float(fx["size"]) * (0.35 + t * 0.9)
	var colour := Color(fx.get("color", "#ffb257"))
	colour.a = (1.0 - t) * 0.9
	_billboard(Vector3(x, _ground(x, y) + size * 0.35, y), size, colour)
	return 1


func _spark(fx: Dictionary, age: float) -> int:
	var x: float = fx["x"]
	var y: float = fx["y"]
	if not _visible_at(x, y):
		return 0
	var t: float = clampf(age / (EFFECT_LIFE * 0.35), 0.0, 1.0)
	if t >= 1.0:
		return 0
	var colour := Color(fx.get("color", "#ffe9b0"))
	colour.a = (1.0 - t) * 0.85
	_billboard(Vector3(x, _ground(x, y) + 12.0, y), float(fx["size"]) * (1.0 - t * 0.4), colour)
	return 1


## A builder's nanolathe: a thin quad from the builder to whatever it is
## working on. Re-emitted by the simulation every few ticks, so it only has to
## live long enough to bridge the gap.
func _beam(fx: Dictionary, age: float) -> int:
	if age > BEAM_LIFE:
		return 0
	var x: float = fx["x"]
	var y: float = fx["y"]
	var tx: float = fx["tx"]
	var ty: float = fx["ty"]
	if not _visible_at(tx, ty):
		return 0
	var from := Vector3(x, _ground(x, y) + 16.0, y)
	var to := Vector3(tx, _ground(tx, ty) + 14.0, ty)
	var colour := (
		Color(0.45, 0.95, 0.62, 0.28) if bool(fx.get("reclaim", false))
		else Color(0.45, 0.78, 1.0, 0.28)
	)
	var side := (to - from).cross(Vector3.UP).normalized() * 1.1
	if side.length_squared() < 1e-6:
		return 0
	_quad(from - side, from + side, to + side, to - side, colour)
	return 1


## A flat ring on the ground, for construction starting and finishing.
func _ring(fx: Dictionary, age: float) -> int:
	var x: float = fx["x"]
	var y: float = fx["y"]
	if not _visible_at(x, y):
		return 0
	var t: float = clampf(age / EFFECT_LIFE, 0.0, 1.0)
	var size: float = float(fx.get("size", 40.0)) * (0.4 + t * 0.8)
	var colour := Color(0.45, 0.82, 1.0, (1.0 - t) * 0.5)
	var h: float = _ground(x, y) + 2.0
	var segments := 16
	var inner: float = size * 0.82
	for i in range(segments):
		var a0: float = (float(i) / segments) * TAU
		var a1: float = (float(i + 1) / segments) * TAU
		_quad(
			Vector3(x + cos(a0) * inner, h, y + sin(a0) * inner),
			Vector3(x + cos(a0) * size, h, y + sin(a0) * size),
			Vector3(x + cos(a1) * size, h, y + sin(a1) * size),
			Vector3(x + cos(a1) * inner, h, y + sin(a1) * inner),
			colour
		)
	return 1


## A camera-facing quad. Built in world space against the camera's basis so it
## needs no per-instance node or billboard material.
func _billboard(centre: Vector3, size: float, colour: Color) -> void:
	var cam := get_viewport().get_camera_3d()
	var right := Vector3.RIGHT
	var up := Vector3.BACK
	if cam != null:
		var basis := cam.global_transform.basis
		right = basis.x
		up = basis.y
	var h: float = size * 0.5
	_quad(
		centre - right * h - up * h,
		centre + right * h - up * h,
		centre + right * h + up * h,
		centre - right * h + up * h,
		colour
	)


func _quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, colour: Color) -> void:
	_flash_mesh.surface_set_color(colour)
	_flash_mesh.surface_add_vertex(a)
	_flash_mesh.surface_add_vertex(b)
	_flash_mesh.surface_add_vertex(c)
	_flash_mesh.surface_set_color(colour)
	_flash_mesh.surface_add_vertex(a)
	_flash_mesh.surface_add_vertex(c)
	_flash_mesh.surface_add_vertex(d)
