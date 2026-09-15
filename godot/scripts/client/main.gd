extends Node3D

## Model showcase: the terrain with a line-up of both factions standing on it.
## The match itself lives in game.gd; this scene stays because it is the
## quickest way to see every exported asset at once, and the check that the
## map generator, the models and the render path still line up.

const HEIGHT_SCALE := IdTerrainBuilder.HEIGHT_SCALE

@export var map_seed: int = 42

var map: IdGameMap
var terrain: IdTerrainBuilder

const BLUE := {
	"primary": Color(0.29, 0.64, 1.0),
	"dark": Color(0.11, 0.31, 0.53),
	"light": Color(0.66, 0.83, 1.0),
}
const GREEN := {
	"primary": Color(0.42, 0.72, 0.30),
	"dark": Color(0.16, 0.30, 0.12),
	"light": Color(0.70, 0.88, 0.55),
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
	var closeup := ""
	for arg in OS.get_cmdline_user_args():
		if arg == "--diag":
			diag = true
		elif arg.begins_with("--closeup="):
			closeup = arg.substr(10)
	IdSceneSetup.build_environment(self)
	IdSceneSetup.build_terrain(self, terrain, diag)
	if not diag:
		IdSceneSetup.build_water(self, map, terrain)
	if closeup != "":
		_place_closeup(closeup.split(","))
	else:
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

	var bots := ["commander", "rifle", "rocket", "heavy", "siege", "scout"]
	for i in bots.size():
		spawn_model(bots[i], ox - 180.0 + float(i) * 62.0, oz + 190, RED, PI * 1.04)

	# The hive, which is grown rather than built and should read that way.
	var hive := ["bl_hive", "bl_skitter", "bl_husk", "bl_spitter", "bl_brute",
		"bl_lobber", "bl_tender"]
	for i in hive.size():
		spawn_model(hive[i], ox - 200.0 + float(i) * 66.0, oz + 310, GREEN, PI * 0.98)
	var hive_buildings := ["bl_pit", "bl_vent", "bl_bloom", "bl_thorn", "bl_spire"]
	for i in hive_buildings.size():
		spawn_model(hive_buildings[i], ox - 200.0 + float(i) * 92.0, oz + 430, GREEN)

	# Structures behind the line, so the buildings read too.
	spawn_model("con_yard", ox - 120, oz - 150, BLUE)
	spawn_model("con_diesel", ox + 20, oz - 150, BLUE)
	spawn_model("con_fusion", ox + 140, oz - 160, BLUE)
	spawn_model("con_pillbox", ox + 230, oz - 60, BLUE)
	var spot: Dictionary = map.nearest_free_metal_spot(ox, oz)
	if not spot.is_empty():
		spawn_model("con_derrick", spot["x"], spot["y"], BLUE)

## A handful of models filling the frame, for judging their detail rather than
## their silhouette. The wide showcase is too far out to see whether a hull has
## panel lines on it.
func _place_closeup(ids: PackedStringArray) -> void:
	var start: Dictionary = map.start_positions[0]
	var ox: float = start["x"]
	var oz: float = start["y"]

	# Spacing and camera distance are measured off the models rather than
	# fixed. A frame sized for a tank puts a six-unit soldier twenty pixels
	# tall, which is the game view -- useful, but not what a close-up is for.
	var spawned: Array[Node3D] = []
	for i in ids.size():
		var id := ids[i].strip_edges()
		if id == "":
			continue
		var colours := BLUE
		if id.begins_with("bl_"):
			colours = GREEN
		elif not id.begins_with("con_"):
			colours = RED
		var node := spawn_model(id, ox, oz, colours, PI * 0.15)
		if node != null:
			spawned.append(node)

	var biggest := 0.0
	for node in spawned:
		biggest = maxf(biggest, _model_extent(node))
	biggest = maxf(biggest, 1.0)

	var spacing: float = biggest * 2.6
	var span: float = spacing * float(maxi(spawned.size() - 1, 1))
	for i in spawned.size():
		var node := spawned[i]
		node.position.x = ox - span * 0.5 + float(i) * spacing
		node.position.z = oz

	var target := Vector3(ox, terrain.height_at(ox, oz) + biggest * 0.5, oz)
	var cam := Camera3D.new()
	cam.name = "Camera"
	cam.fov = 34.0
	cam.far = 12000.0
	var pitch := 0.55
	# Enough to hold the whole row, with the tallest model filling the frame
	# when there is only one.
	var dist: float = maxf(biggest * 4.0, span * 1.6 + biggest * 2.0)
	cam.position = target + Vector3(0, sin(pitch) * dist, cos(pitch) * dist)
	add_child(cam)
	cam.look_at(target, Vector3.UP)
	cam.make_current()


## Half the largest side of a spawned model's visual bounds, in world units.
func _model_extent(node: Node3D) -> float:
	var extent := 0.0
	for child in node.get_children():
		if child is VisualInstance3D:
			var box: AABB = (child as VisualInstance3D).get_aabb()
			extent = maxf(extent, maxf(box.size.x, maxf(box.size.y, box.size.z)) * 0.5)
	return extent


func _place_camera() -> void:
	var start: Dictionary = map.start_positions[0]
	# Centred on the line-up, which is now four rows deep rather than two.
	var target := Vector3(start["x"], terrain.height_at(start["x"], start["y"]), start["y"] + 200.0)
	var cam := Camera3D.new()
	cam.name = "Camera"
	cam.fov = 48.0
	cam.far = 12000.0
	var pitch := 0.92
	var dist := 860.0
	cam.position = target + Vector3(0, sin(pitch) * dist, cos(pitch) * dist)
	# look_at needs the node in the tree, so parent it first.
	add_child(cam)
	cam.look_at(target, Vector3.UP)
	cam.make_current()
