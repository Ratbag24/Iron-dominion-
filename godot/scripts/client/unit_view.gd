class_name IdUnitView
extends Node3D

## Keeps a scene node in step with every live entity in the simulation.
##
## The simulation never touches the scene tree, so this is the only place the
## two meet: each tick it adds nodes for entities that appeared, frees nodes
## for entities that died, and writes positions and turret angles onto the
## rest. Nothing here is allowed to write back into the world.

const NANOFRAME_COLOUR := Color(0.35, 0.62, 0.85)

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
		node.position = Vector3(e.x, terrain.height_at(e.x, e.y), e.y)
		# Simulation headings are measured in the XZ plane with +X at zero and
		# y growing "south"; Godot's yaw runs the other way round.
		node.rotation.y = -e.heading
		var turret: Node3D = _turrets.get(e.id)
		if turret != null:
			turret.rotation.y = -e.turret_angle + e.heading
		if e.under_construction:
			node.scale = Vector3.ONE * maxf(0.35, e.build_progress)

	_sync_blips()

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
	_nodes.clear()
	_turrets.clear()
	_blips.clear()
