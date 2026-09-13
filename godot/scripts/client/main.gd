extends Node3D

## Builds the world: terrain, water, sky, light, and a set of models standing
## on the ground. The simulation is still being ported, so this places units
## directly rather than running a match - it exists to prove the map generator,
## the exported assets and the render path all line up in Godot.

const HEIGHT_SCALE := IdTerrainBuilder.HEIGHT_SCALE

@export var map_seed: int = 42

var map: IdGameMap
var terrain: IdTerrainBuilder

const BLUE := {
	"primary": Color(0.29, 0.64, 1.0),
	"dark": Color(0.11, 0.31, 0.53),
	"light": Color(0.66, 0.83, 1.0),
}
const RED := {
	"primary": Color(1.0, 0.35, 0.29),
	"dark": Color(0.55, 0.16, 0.12),
	"light": Color(1.0, 0.70, 0.66),
}

func _ready() -> void:
	var t0 := Time.get_ticks_msec()
	map = IdGameMap.new(map_seed)
	terrain = IdTerrainBuilder.new(map, 2)
	print("map generated in %dms" % (Time.get_ticks_msec() - t0))

	var diag := false
	for arg in OS.get_cmdline_user_args():
		if arg == "--diag":
			diag = true
	_build_environment()
	_build_terrain(diag)
	if not diag:
		_build_water()
	_place_showcase()
	_place_camera()
	print("scene ready: %d nodes" % _count_nodes(self))

	# Capture a frame and exit, when asked to from the command line.
	var shot_path := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--shot="):
			shot_path = arg.substr(7)
	if shot_path != "":
		var helper := preload("res://scripts/client/screenshot.gd").new()
		helper.out_path = shot_path
		add_child(helper)

func _count_nodes(n: Node) -> int:
	var total := 1
	for c in n.get_children():
		total += _count_nodes(c)
	return total

func _build_environment() -> void:
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
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.92, 0.78)
	sun.light_energy = 1.55
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-48, -128, 0)
	add_child(sun)

	var rim := DirectionalLight3D.new()
	rim.light_color = Color(0.53, 0.71, 1.0)
	rim.light_energy = 0.4
	rim.rotation_degrees = Vector3(-28, 52, 0)
	add_child(rim)

func _build_terrain(diag: bool = false) -> void:
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
	mi.material_override = mat
	print("terrain aabb: %s  visible: %s" % [str(mi.mesh.get_aabb()), str(mi.visible)])
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

func _build_water() -> void:
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
	add_child(mi)

func spawn_model(id: String, x: float, z: float, colours: Dictionary, heading: float = 0.0) -> Node3D:
	var path := "res://assets/models/%s.glb" % id
	if not ResourceLoader.exists(path):
		push_warning("missing model: %s" % id)
		return null
	var scene: PackedScene = load(path)
	var inst: Node3D = scene.instantiate()
	IdTeamColour.apply(inst, colours)
	inst.position = Vector3(x, terrain.height_at(x, z), z)
	inst.rotation.y = heading
	add_child(inst)
	return inst

## A line-up of both factions on the ground near the first start position.
func _place_showcase() -> void:
	var start: Dictionary = map.start_positions[0]
	var ox: float = start["x"]
	var oz: float = start["y"]

	spawn_model("con_commander", ox, oz - 40, BLUE, PI * 0.1)
	var concord := ["con_tank", "con_tank", "con_missile", "con_heavytank", "con_howitzer", "con_jeep"]
	for i in concord.size():
		spawn_model(concord[i], ox - 150.0 + float(i) * 62.0, oz + 70, BLUE, PI * 0.06)

	var bots := ["commander", "rifle", "rifle", "rocket", "heavy", "siege", "scout"]
	for i in bots.size():
		spawn_model(bots[i], ox - 180.0 + float(i) * 62.0, oz + 190, RED, PI * 1.04)

	# Structures behind the line, so the buildings read too.
	spawn_model("con_yard", ox - 120, oz - 150, BLUE)
	spawn_model("con_diesel", ox + 20, oz - 150, BLUE)
	spawn_model("con_fusion", ox + 140, oz - 160, BLUE)
	spawn_model("con_pillbox", ox + 230, oz - 60, BLUE)
	var spot: Dictionary = map.nearest_free_metal_spot(ox, oz)
	if not spot.is_empty():
		spawn_model("con_derrick", spot["x"], spot["y"], BLUE)

func _place_camera() -> void:
	var start: Dictionary = map.start_positions[0]
	var target := Vector3(start["x"], terrain.height_at(start["x"], start["y"]), start["y"] + 60.0)
	var cam := Camera3D.new()
	cam.name = "Camera"
	cam.fov = 48.0
	cam.far = 12000.0
	var pitch := 0.86
	var dist := 560.0
	cam.position = target + Vector3(0, sin(pitch) * dist, cos(pitch) * dist)
	# look_at needs the node in the tree, so parent it first.
	add_child(cam)
	cam.look_at(target, Vector3.UP)
	cam.make_current()
