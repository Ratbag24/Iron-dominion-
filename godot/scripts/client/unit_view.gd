class_name IdUnitView
extends Node3D

## Keeps a scene node in step with every live entity in the simulation.
##
## The simulation never touches the scene tree, so this is the only place the
## two meet: each tick it adds nodes for entities that appeared, frees nodes
## for entities that died, and writes positions and turret angles onto the
## rest. Nothing here is allowed to write back into the world.

const NANOFRAME_COLOUR := Color(0.35, 0.62, 0.85)

## How far either side of a unit the ground is sampled to find its slope.
## About a unit's own length: shorter and every pebble tips it over.
const SLOPE_SAMPLE: float = 14.0

## Wrecks keep their shape but lose their allegiance.
const WRECK_COLOURS := {
	"primary": Color(0.26, 0.25, 0.24),
	"dark": Color(0.15, 0.145, 0.14),
	"light": Color(0.36, 0.35, 0.33),
}

var world: IdWorld
var terrain: IdTerrainBuilder

## Whose vision decides what is drawn. -1 shows everything, which is what the
## self-playing render path wants.
var viewer: int = 0

var _nodes: Dictionary = {}       ## entity id -> Node3D
var _turrets: Dictionary = {}     ## entity id -> Node3D (or null)
var _scene_cache: Dictionary = {} ## def id -> PackedScene
var _missing: Dictionary = {}     ## def ids we have already warned about
var _team_colours: Array[Dictionary] = []
var _blips: Dictionary = {}       ## entity id -> Node3D marker
var _blip_mesh: Mesh = null
var _wrecks: Dictionary = {}      ## wreck id -> Node3D


func setup(w: IdWorld, t: IdTerrainBuilder, viewer_index: int = 0) -> void:
	world = w
	terrain = t
	viewer = viewer_index
	_team_colours.clear()
	for p in w.players:
		_team_colours.append({
			"primary": Color(p.color["primary"]),
			"dark": Color(p.color["dark"]),
			"light": Color(p.color["light"]),
		})


## Add, remove and move nodes so the scene matches the world. Called once per
## rendered frame, not once per simulation tick: interpolation is cheap and
## the tick rate is deliberately lower than the frame rate.
func sync() -> void:
	var seen: Dictionary = {}

	var fog: IdFogMap = world.fog[viewer] if viewer >= 0 else null
	var viewer_team: int = world.players[viewer].team if viewer >= 0 else -1

	for e in world.entities:
		if not e.alive:
			continue
		# An enemy is only drawn while something of ours can see it. Radar
		# gives a contact without an identity, so a radar-only unit is drawn
		# as a blip rather than as itself.
		# Its model is dropped either way; a radar contact is drawn by
		# _sync_blips instead, as a marker with no identity.
		if fog != null and world.players[e.player].team != viewer_team:
			if not fog.is_visible_at(e.x, e.y):
				continue
		seen[e.id] = true
		var node: Node3D = _nodes.get(e.id)
		if node == null:
			node = _create(e)
			if node == null:
				continue
		var ground := terrain.height_at(e.x, e.y)
		# Simulation headings are measured in the XZ plane with +X at zero and
		# y growing "south"; Godot's yaw runs the other way round.
		var yaw := -e.heading
		if e.is_building:
			node.position = Vector3(e.x, ground, e.y)
			node.rotation = Vector3(0.0, yaw, 0.0)
		else:
			# Mobile units lie along the slope they are standing on. Without
			# this they stay bolt upright on a hillside, which reads as
			# hovering rather than as driving.
			node.transform = Transform3D(
				_slope_basis(e.x, e.y, yaw), Vector3(e.x, ground, e.y)
			)
		var turret: Node3D = _turrets.get(e.id)
		if turret != null:
			turret.rotation.y = -e.turret_angle + e.heading
		if e.under_construction:
			node.scale = Vector3.ONE * maxf(0.35, e.build_progress)

	_sync_blips()
	_sync_wrecks()

	var stale: Array = []
	for id in _nodes:
		if not seen.has(id):
			stale.append(id)
	for id in stale:
		var node: Node3D = _nodes[id]
		if is_instance_valid(node):
			node.queue_free()
		_nodes.erase(id)
		_turrets.erase(id)


## Wrecks are the dead unit's own model, darkened and sunk into the ground.
## They are worth metal, so the player has to be able to see them; a wreck the
## simulation is tracking but nothing draws is reclaim income nobody claims.
func _sync_wrecks() -> void:
	var fog: IdFogMap = world.fog[viewer] if viewer >= 0 else null
	var wanted: Dictionary = {}
	for w in world.wrecks:
		if float(w["metal_left"]) <= 0.0:
			continue
		if fog != null and not fog.is_explored(w["x"], w["y"]):
			continue
		wanted[w["id"]] = w

	for id in wanted:
		if _wrecks.has(id):
			continue
		var w: Dictionary = wanted[id]
		var scene: PackedScene = _scene_for(w["def_id"])
		if scene == null:
			continue
		var inst: Node3D = scene.instantiate()
		IdTeamColour.apply(inst, WRECK_COLOURS)
		add_child(inst)
		inst.position = Vector3(
			w["x"], terrain.height_at(w["x"], w["y"]) - float(w["radius"]) * 0.25, w["y"]
		)
		inst.rotation.y = -float(w["heading"])
		# Tipped over, so a wreck reads as debris at a glance rather than as a
		# unit that has stopped moving.
		inst.rotation.x = 0.22
		inst.scale = Vector3(1.0, 0.55, 1.0)
		_wrecks[id] = inst

	var gone: Array = []
	for id in _wrecks:
		if not wanted.has(id):
			gone.append(id)
	for id in gone:
		var node: Node3D = _wrecks[id]
		if is_instance_valid(node):
			node.queue_free()
		_wrecks.erase(id)


## Radar contacts: a marker where something is moving, with no idea what.
func _sync_blips() -> void:
	if world.fog.size() == 0 or viewer < 0:
		return
	var fog: IdFogMap = world.fog[viewer]
	var viewer_team: int = world.players[viewer].team
	var wanted: Dictionary = {}
	for e in world.entities:
		if not e.alive or e.is_building:
			continue
		if world.players[e.player].team == viewer_team:
			continue
		if fog.is_visible_at(e.x, e.y) or not fog.has_radar(e.x, e.y):
			continue
		wanted[e.id] = e

	for id in wanted:
		var e: IdEntity = wanted[id]
		var blip: Node3D = _blips.get(id)
		if blip == null:
			blip = _make_blip()
			add_child(blip)
			_blips[id] = blip
		blip.position = Vector3(e.x, terrain.height_at(e.x, e.y) + 18.0, e.y)

	var gone: Array = []
	for id in _blips:
		if not wanted.has(id):
			gone.append(id)
	for id in gone:
		var blip: Node3D = _blips[id]
		if is_instance_valid(blip):
			blip.queue_free()
		_blips.erase(id)


func _make_blip() -> MeshInstance3D:
	if _blip_mesh == null:
		var sphere := SphereMesh.new()
		sphere.radius = 7.0
		sphere.height = 14.0
		sphere.radial_segments = 8
		sphere.rings = 4
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.95, 0.72, 0.25)
		mat.emission_enabled = true
		mat.emission = Color(0.95, 0.72, 0.25)
		mat.emission_energy_multiplier = 2.0
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		sphere.material = mat
		_blip_mesh = sphere
	var mi := MeshInstance3D.new()
	mi.mesh = _blip_mesh
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


## An orientation that faces `yaw` and lies flat on the ground beneath.
##
## The normal comes from sampling the heightfield either side of the unit,
## rather than from the mesh, so it follows the same surface the simulation
## walks on.
func _slope_basis(x: float, y: float, yaw: float) -> Basis:
	var r := SLOPE_SAMPLE
	var dx := terrain.height_at(x + r, y) - terrain.height_at(x - r, y)
	var dy := terrain.height_at(x, y + r) - terrain.height_at(x, y - r)
	var normal := Vector3(-dx, 2.0 * r, -dy).normalized()

	# Start from the upright rotation that already gives the right heading and
	# lean it onto the normal, rather than rebuilding the heading by hand and
	# having to rediscover which way Godot's yaw turns.
	var flat := Basis(Vector3.UP, yaw)
	var right := normal.cross(flat.z)
	if right.length_squared() < 1e-8:
		return flat
	right = right.normalized()
	return Basis(right, normal, right.cross(normal).normalized())


func _create(e: IdEntity) -> Node3D:
	var scene: PackedScene = _scene_for(e.def_id)
	if scene == null:
		return null
	var inst: Node3D = scene.instantiate()
	IdTeamColour.apply(inst, _team_colours[e.player])
	add_child(inst)
	_nodes[e.id] = inst
	var turret: Node = inst.get_node_or_null("turret")
	_turrets[e.id] = turret if turret is Node3D else null
	return inst


func _scene_for(def_id: String) -> PackedScene:
	if _scene_cache.has(def_id):
		return _scene_cache[def_id]
	var path := "res://assets/models/%s.glb" % def_id
	if not ResourceLoader.exists(path):
		if not _missing.has(def_id):
			_missing[def_id] = true
			push_warning("no model for %s" % def_id)
		_scene_cache[def_id] = null
		return null
	var scene: PackedScene = load(path)
	_scene_cache[def_id] = scene
	return scene


## The node drawn for an entity, or null when it has none.
func node_for(entity_id: int) -> Node3D:
	return _nodes.get(entity_id)


func clear() -> void:
	for id in _nodes:
		var node: Node3D = _nodes[id]
		if is_instance_valid(node):
			node.queue_free()
	for id in _blips:
		var blip: Node3D = _blips[id]
		if is_instance_valid(blip):
			blip.queue_free()
	for id in _wrecks:
		var node: Node3D = _wrecks[id]
		if is_instance_valid(node):
			node.queue_free()
	_nodes.clear()
	_turrets.clear()
	_blips.clear()
	_wrecks.clear()
