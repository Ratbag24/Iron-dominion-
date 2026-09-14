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
	var mat := StandardMaterial3D.new()
	if diag:
		mat.albedo_color = Color(1, 0.2, 0.2)
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	else:
		mat.vertex_color_use_as_albedo = true
		mat.roughness = 0.94
		mat.metallic = 0.0
		# The ground mesh carries one vertex every few world units, which is
		# far too coarse to catch the light like ground. A tiling detail
		# normal map puts the fine relief back without adding geometry.
		mat.normal_enabled = true
		mat.normal_texture = detail_normal_texture()
		mat.normal_scale = 0.85
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


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
	mat.albedo_color = Color(0.14, 0.345, 0.486, 0.8)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.roughness = 0.12
	mat.metallic = 0.35
	mi.material_override = mat
	mi.position = Vector3(map.width * 0.5, terrain.water_level() + 1.0, map.height * 0.5)
	parent.add_child(mi)
	return mi
