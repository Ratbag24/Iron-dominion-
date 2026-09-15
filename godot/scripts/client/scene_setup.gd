class_name IdSceneSetup

## Shared scene furniture: sky, lights, ground mesh and water. Both the match
## scene and the model showcase build the same world, so the setup lives here
## rather than being written twice and drifting apart.


static func build_environment(parent: Node) -> void:
	var env := Environment.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.055, 0.102, 0.169)
	sky_mat.sky_horizon_color = Color(0.29, 0.373, 0.471)
	sky_mat.ground_bottom_color = Color(0.086, 0.094, 0.102)
	sky_mat.ground_horizon_color = Color(0.29, 0.373, 0.471)
	sky_mat.sun_angle_max = 22.0
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	# Ambient is taken from a neutral colour rather than from the sky, and the
	# sky is kept for reflections. Sky ambient means a dark blue sky fills every
	# shadowed face with dark blue: a grey hull measured at under half its
	# authored value and well into navy, so painted metal read as black plastic.
	# Strength alone cannot fix that - the hue has to come from somewhere else.
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.66, 0.69, 0.74)
	env.ambient_light_energy = 1.0
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.95
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.15
	env.fog_enabled = true
	env.fog_light_color = Color(0.15, 0.2, 0.27)
	env.fog_density = 0.0006

	var we := WorldEnvironment.new()
	we.environment = env
	parent.add_child(we)

	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.92, 0.78)
	sun.light_energy = 1.35
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-48, -128, 0)
	parent.add_child(sun)

	var rim := DirectionalLight3D.new()
	rim.light_color = Color(0.53, 0.71, 1.0)
	rim.light_energy = 0.55
	rim.rotation_degrees = Vector3(-28, 52, 0)
	parent.add_child(rim)


## `prebuilt` is the ground mesh when it was generated ahead of time on the
## loading thread; without it the mesh is built here, which is what the model
## showcase does.
static func build_terrain(
	parent: Node, terrain: IdTerrainBuilder, diag: bool = false, prebuilt: Mesh = null
) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = "Terrain"
	mi.mesh = prebuilt if prebuilt != null else terrain.build_mesh()
	if diag:
		var flat := StandardMaterial3D.new()
		flat.albedo_color = Color(1, 0.2, 0.2)
		flat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mi.material_override = flat
	else:
		mi.material_override = ground_material(terrain)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


## The ground shader with its generated textures bound. The images behind it
## come from IdGroundTextures, built on the loading thread when there is one;
## only the wrapping for the GPU happens here on the main thread.
static var _ground_textures: IdGroundTextures = null
static var _ground_shader: Shader = null


## Build the ground textures ahead of time, off the main thread. Safe to call
## more than once; the second call is free.
static func prepare_ground_textures() -> IdGroundTextures:
	if _ground_textures == null:
		_ground_textures = IdGroundTextures.new()
	return _ground_textures


static func ground_material(terrain: IdTerrainBuilder) -> ShaderMaterial:
	if _ground_shader == null:
		_ground_shader = load("res://shaders/ground.gdshader")
	var tex := prepare_ground_textures()
	var mat := ShaderMaterial.new()
	mat.shader = _ground_shader
	for name in ["grass", "earth", "rock", "sand", "creep"]:
		mat.set_shader_parameter(name + "_albedo",
			ImageTexture.create_from_image(tex.images[name + "_albedo"]))
		mat.set_shader_parameter(name + "_normal",
			ImageTexture.create_from_image(tex.images[name + "_normal"]))
	var map: IdGameMap = terrain.map
	mat.set_shader_parameter("map_size", Vector2(map.width, map.height))
	mat.set_shader_parameter("corruption", blank_corruption(map))
	return mat


## An all-black corruption map, for scenes with no simulation writing one.
static func blank_corruption(map: IdGameMap) -> ImageTexture:
	var img := Image.create(map.cols, map.rows, false, Image.FORMAT_R8)
	img.fill(Color.BLACK)
	return ImageTexture.create_from_image(img)


## The detail normal map, uploaded once per run. The image behind it is
## generated on the loading thread; only this wrapping happens on the main one.
static var _normal_texture: ImageTexture = null


static func detail_normal_texture() -> ImageTexture:
	if _normal_texture == null:
		_normal_texture = ImageTexture.create_from_image(
			IdTerrainBuilder.detail_normal_image()
		)
	return _normal_texture


static func build_water(parent: Node, map: IdGameMap, terrain: IdTerrainBuilder) -> MeshInstance3D:
	var plane := PlaneMesh.new()
	plane.size = Vector2(map.width * 1.4, map.height * 1.4)
	var mi := MeshInstance3D.new()
	mi.name = "Water"
	mi.mesh = plane
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.1, 0.27, 0.4, 0.86)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.roughness = 0.12
	mat.metallic = 0.35
	mi.material_override = mat
	mi.position = Vector3(map.width * 0.5, terrain.water_level() + 1.0, map.height * 0.5)
	parent.add_child(mi)
	return mi
