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
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.42
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
	sun.light_energy = 1.55
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-48, -128, 0)
	parent.add_child(sun)

	var rim := DirectionalLight3D.new()
	rim.light_color = Color(0.53, 0.71, 1.0)
	rim.light_energy = 0.4
	rim.rotation_degrees = Vector3(-28, 52, 0)
	parent.add_child(rim)


static func build_terrain(parent: Node, terrain: IdTerrainBuilder, diag: bool = false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = "Terrain"
	mi.mesh = terrain.build_mesh()
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
		mat.normal_texture = IdTerrainBuilder.detail_normal_map()
		mat.normal_scale = 0.85
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


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
