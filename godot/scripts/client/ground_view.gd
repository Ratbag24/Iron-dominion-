class_name IdGroundView
extends Node

## Keeps the ground shader in step with the simulation.
##
## The infection lives in the simulation as one float per cell. This uploads
## it as a texture whenever a spread pass has run, and advances the shader's
## clock so the creep pulses. Nothing else about the ground changes at
## runtime, so this is the whole of the ground's view.

var _world: IdWorld
var _material: ShaderMaterial
var _image: Image
var _texture: ImageTexture
var _last_uploaded_tick: int = -1
var _clock: float = 0.0

## Fog of war for the viewing player, uploaded to the ground and water
## shaders whenever the fog map's version changes. -1 means see everything.
var _viewer: int = -1
var _fog_image: Image
var _fog_texture: ImageTexture
var _fog_version: int = -1
var _fog_bytes: PackedByteArray = PackedByteArray()
## Other materials that show the fog too - the water.
var _also: Array[ShaderMaterial] = []


func setup(world: IdWorld, material: ShaderMaterial, viewer: int = -1, also: Array[ShaderMaterial] = []) -> void:
	_world = world
	_material = material
	_viewer = viewer
	_also = also
	var map: IdGameMap = world.map
	_image = Image.create(map.cols, map.rows, false, Image.FORMAT_R8)
	_image.fill(Color.BLACK)
	_texture = ImageTexture.create_from_image(_image)
	_material.set_shader_parameter("corruption", _texture)
	_material.set_shader_parameter("map_size", Vector2(map.width, map.height))
	for m in _also:
		m.set_shader_parameter("map_size", Vector2(map.width, map.height))
	if _viewer >= 0 and _viewer < world.fog.size():
		var fog: IdFogMap = world.fog[_viewer]
		_fog_image = Image.create(fog.cols, fog.rows, false, Image.FORMAT_R8)
		_fog_image.fill(Color.BLACK)
		_fog_texture = ImageTexture.create_from_image(_fog_image)
		_fog_bytes.resize(fog.cols * fog.rows)
		_material.set_shader_parameter("fog_map", _fog_texture)
		for m in _also:
			m.set_shader_parameter("fog_map", _fog_texture)
		sync_fog()


func _process(dt: float) -> void:
	if _world == null:
		return
	_clock += dt
	_material.set_shader_parameter("creep_time", _clock)
	# A spread pass runs every CREEP_INTERVAL ticks; uploading between passes
	# would send the same bytes again.
	sync_fog()
	var pass_tick: int = _world.tick_count - (_world.tick_count % IdCreep.CREEP_INTERVAL)
	if pass_tick == _last_uploaded_tick:
		return
	_last_uploaded_tick = pass_tick
	sync()


## Upload the viewer's fog if it has changed since the last upload.
func sync_fog() -> void:
	if _fog_texture == null:
		return
	var fog: IdFogMap = _world.fog[_viewer]
	if fog.version == _fog_version:
		return
	_fog_version = fog.version
	var vis: PackedByteArray = fog.visible_cells
	var exp: PackedByteArray = fog.explored
	for i in _fog_bytes.size():
		_fog_bytes[i] = 255 if vis[i] != 0 else (128 if exp[i] != 0 else 0)
	_fog_image.set_data(fog.cols, fog.rows, false, Image.FORMAT_R8, _fog_bytes)
	_fog_texture.update(_fog_image)


## Copy the corruption grid into the texture.
func sync() -> void:
	var map: IdGameMap = _world.map
	var corr: PackedFloat32Array = map.corruption
	var bytes := PackedByteArray()
	bytes.resize(corr.size())
	for i in corr.size():
		bytes[i] = int(clampf(corr[i], 0.0, 1.0) * 255.0)
	_image.set_data(map.cols, map.rows, false, Image.FORMAT_R8, bytes)
	_texture.update(_image)
	sync_fog()
