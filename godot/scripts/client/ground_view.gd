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


func setup(world: IdWorld, material: ShaderMaterial) -> void:
	_world = world
	_material = material
	var map: IdGameMap = world.map
	_image = Image.create(map.cols, map.rows, false, Image.FORMAT_R8)
	_image.fill(Color.BLACK)
	_texture = ImageTexture.create_from_image(_image)
	_material.set_shader_parameter("corruption", _texture)
	_material.set_shader_parameter("map_size", Vector2(map.width, map.height))


func _process(dt: float) -> void:
	if _world == null:
		return
	_clock += dt
	_material.set_shader_parameter("creep_time", _clock)
	# A spread pass runs every CREEP_INTERVAL ticks; uploading between passes
	# would send the same bytes again.
	var pass_tick: int = _world.tick_count - (_world.tick_count % IdCreep.CREEP_INTERVAL)
	if pass_tick == _last_uploaded_tick:
		return
	_last_uploaded_tick = pass_tick
	sync()


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
