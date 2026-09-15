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
## entity id -> Array of {node, phase}: the legs the model exported, each hung
## from its hip. See _animate_walk.
var _legs: Dictionary = {}
var _walk: Dictionary = {}        ## entity id -> gait phase, radians
## entity id -> simulation time of its last shot, for recoil. See _recoil.
var _fired: Dictionary = {}
const RECOIL_TIME: float = 0.22
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
	var frame_dt: float = get_process_delta_time()
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
		# Aircraft fly above the ground rather than on it, and lean into their
		# turns. Without the altitude they taxi through the terrain; without
		# the bank they slide round corners flat, which is the thing that most
		# makes a flying model look like a ground one.
		if e.def.get("layer", "ground") == "air":
			node.transform = Transform3D(
				Basis(Vector3.UP, -e.heading) * Basis(Vector3.RIGHT, -e.bank),
				Vector3(e.x, ground + e.altitude, e.y)
			)
			var air_turret: Node3D = _turrets.get(e.id)
			if air_turret != null:
				air_turret.rotation.y = -e.turret_angle + e.heading
			continue
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
			var bob: float = _animate_walk(e, node, frame_dt)
			node.transform = Transform3D(
				_slope_basis(e.x, e.y, yaw), Vector3(e.x, ground + bob, e.y)
			)
		var turret: Node3D = _turrets.get(e.id)
		var kick: float = _recoil(e)
		if turret != null:
			turret.rotation.y = -e.turret_angle + e.heading
			# Recoil: the turret slides back along its own barrel and eases
			# home. A gun that fires without moving is a light on a stick.
			turret.position.x = -kick * e.radius * 0.18
			turret.position.z = 0.0
		elif kick > 0.0:
			# No turret: the whole body rocks back instead.
			node.position -= node.transform.basis.x * kick * e.radius * 0.1
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
		_legs.erase(id)
		_walk.erase(id)
		_fired.erase(id)


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
	var inst: Node3D
	if scene == null:
		# The placeholder carries its own team colour; IdTeamColour looks for
		# named materials an untextured box does not have.
		inst = _placeholder(e, _team_colours[e.player])
	else:
		inst = scene.instantiate()
		IdTeamColour.apply(inst, _team_colours[e.player])
	add_child(inst)
	_nodes[e.id] = inst
	# Parts are found by name anywhere in the tree: the procedural exporter
	# puts them at the top, an artist's model nests them under a body node.
	var turret: Node = inst.find_child("turret", true, false)
	_turrets[e.id] = turret if turret is Node3D else null
	var legs: Array = []
	for child in inst.find_children("leg_*", "Node3D", true, false):
		legs.append({
			"node": child,
			# The exporter names each leg with the half of the gait it is
			# on: "a" swings forward while "b" plants, then they trade.
			"phase": PI if child.name.ends_with("_b") else 0.0,
			# The swing is applied on top of the rest pose, in the parent's
			# frame, so a leg that was drawn at an angle keeps that angle.
			"rest": (child as Node3D).transform.basis,
		})
	if not legs.is_empty():
		_legs[e.id] = legs
		_walk[e.id] = 0.0
	return inst


## How far back this unit's gun should be right now, 0..1.
##
## Muzzle events carry the shooter; the latest one per unit is remembered and
## decays over RECOIL_TIME. Scanned once per sync rather than indexed, since
## the effects list is short-lived and small.
func _recoil(e: IdEntity) -> float:
	for fx in world.effects:
		if String(fx.get("type", "")) == "muzzle" and int(fx.get("owner", -1)) == e.id:
			var t: float = float(fx["t"])
			if t > float(_fired.get(e.id, -1.0)):
				_fired[e.id] = t
	var since: float = world.time - float(_fired.get(e.id, -100.0))
	if since < 0.0 or since > RECOIL_TIME:
		return 0.0
	var k: float = since / RECOIL_TIME
	# Snap back fast, return slowly.
	return (1.0 - k) * (1.0 - k)


## Swing the legs in time with how fast the unit is actually moving.
##
## A walker that glides is a chess piece; this is the whole of what turns
## exported geometry into something that walks. Each leg rocks about its hip
## (the model's sideways axis, Z: models face +X) by an angle that scales with
## speed, and the body bobs twice per stride. Stopped units settle back to
## their rest pose rather than freezing mid-step.
func _animate_walk(e: IdEntity, node: Node3D, dt: float) -> float:
	var legs: Array = _legs.get(e.id, [])
	if legs.is_empty():
		return 0.0
	var top: float = maxf(1.0, float(e.def.get("speed", 1.0)))
	var pace: float = clampf(e.speed / top, 0.0, 1.4)
	# Stride length scales with the unit, so a squad of infantry patters and
	# a hive lumbers, from the same rule.
	var stride: float = maxf(6.0, e.radius * 1.6)
	var phase: float = _walk[e.id] + e.speed * dt * TAU / (stride * 2.0)
	_walk[e.id] = fmod(phase, TAU)
	var amp: float = 0.55 * pace
	for leg in legs:
		var n: Node3D = leg["node"]
		var swing: float = sin(phase + float(leg["phase"])) * amp
		n.transform.basis = Basis(Vector3.BACK, swing) * leg["rest"]
	# The bob: up on each planted step. Small, or units look like they are
	# on springs.
	return absf(sin(phase)) * e.radius * 0.05 * pace


func _scene_for(def_id: String) -> PackedScene:
	if _scene_cache.has(def_id):
		return _scene_cache[def_id]
	var path := "res://assets/models/%s.glb" % def_id
	if not ResourceLoader.exists(path):
		if not _missing.has(def_id):
			_missing[def_id] = true
			push_warning("no model for %s; drawing a placeholder" % def_id)
		_scene_cache[def_id] = null
		return null
	var scene: PackedScene = load(path)
	_scene_cache[def_id] = scene
	return scene


## A box the size of the thing it stands in for.
##
## A unit with no model used to be drawn as nothing at all, which looks exactly
## like a bug in the simulation rather than a missing asset - the browser build
## has always fallen back to a box, and this one should too.
func _placeholder(e: IdEntity, colours: Dictionary) -> Node3D:
	var size: float = (
		float(e.def.get("footprintPx", e.radius * 2.0)) if e.is_building
		else e.radius * 1.8
	)
	var box := BoxMesh.new()
	box.size = Vector3(size, size * 0.7, size)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = colours["primary"]
	mat.roughness = 0.6
	box.material = mat
	var mi := MeshInstance3D.new()
	mi.mesh = box
	mi.position.y = size * 0.35
	var holder := Node3D.new()
	holder.name = "body"
	holder.add_child(mi)
	return holder


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
