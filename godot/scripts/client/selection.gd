class_name IdSelection
extends RefCounted

## Unit picking and order issuing for the local player.
##
## Picking works in screen space: every one of the player's units is projected
## and tested against the cursor. That is cheaper than raycasting collision
## shapes we would otherwise have no reason to build, and it picks small units
## the way players expect — by where they appear, not by where their hull is.

const PICK_RADIUS: float = 26.0   ## pixels
const DRAG_THRESHOLD: float = 6.0 ## pixels before a click becomes a box

var world: IdWorld
var cam: IdRtsCamera
var player_index: int = 0

## Set by the game, so a click can be heard. Optional: the automated paths run
## without one.
var sound: IdSoundView = null

## Entity ids currently selected.
var selected: Array[int] = []

var dragging: bool = false
var drag_start: Vector2 = Vector2.ZERO
var drag_end: Vector2 = Vector2.ZERO

## Definition id the player is placing, or "" when not in build mode.
var build_def: String = ""

## A command waiting for the player to click a target: attack-move, patrol and
## the rest all pick their point the same way, so they share one slot.
var pending_command: String = ""


func setup(w: IdWorld, c: IdRtsCamera, index: int) -> void:
	world = w
	cam = c
	player_index = index


func selected_entities() -> Array[IdEntity]:
	var out: Array[IdEntity] = []
	for id in selected:
		var e: IdEntity = world.get_entity(id)
		if e != null:
			out.append(e)
	return out


## Drop ids whose entities have died, so the selection does not accumulate
## ghosts over a long match.
func prune() -> void:
	var live: Array[int] = []
	for id in selected:
		var e: IdEntity = world.get_entity(id)
		if e != null:
			live.append(id)
			e.selected = true
	selected = live


func _deselect_all() -> void:
	for id in selected:
		var e: IdEntity = world.get_entity(id)
		if e != null:
			e.selected = false
	selected.clear()


## Replace or extend the selection.
func select_ids(ids: Array[int], additive: bool) -> void:
	if not additive:
		_deselect_all()
	var added := false
	for id in ids:
		if not selected.has(id):
			selected.append(id)
			added = true
			var e: IdEntity = world.get_entity(id)
			if e != null:
				e.selected = true
	if added and sound != null:
		sound.play_ui("select")


## The player's unit nearest the cursor, or 0 when nothing is close enough.
func pick_at(screen_pos: Vector2) -> int:
	var best: int = 0
	var best_d: float = PICK_RADIUS * PICK_RADIUS
	for e in world.entities:
		if not e.alive or e.player != player_index:
			continue
		var world_pos := Vector3(e.x, cam.terrain.height_at(e.x, e.y) + e.radius * 0.6, e.y)
		if cam.is_position_behind(world_pos):
			continue
		var screen := cam.unproject_position(world_pos)
		var d: float = screen.distance_squared_to(screen_pos)
		# Bigger things are easier to hit, which is what a hull-shaped pick
		# would have given us anyway.
		var reach: float = PICK_RADIUS + e.radius * 0.25
		if d < best_d and d < reach * reach:
			best_d = d
			best = e.id
	return best


func pick_in_box(a: Vector2, b: Vector2) -> Array[int]:
	var rect := Rect2(a, Vector2.ZERO).expand(b)
	var out: Array[int] = []
	for e in world.entities:
		if not e.alive or e.player != player_index:
			continue
		# A box drag selects mobile units only, as in every RTS: otherwise
		# dragging over your own base picks up the buildings under it.
		if e.is_building:
			continue
		var world_pos := Vector3(e.x, cam.terrain.height_at(e.x, e.y) + e.radius * 0.6, e.y)
		if cam.is_position_behind(world_pos):
			continue
		if rect.has_point(cam.unproject_position(world_pos)):
			out.append(e.id)
	return out


## Every unit of the same type as the one under the cursor, on screen.
func pick_same_type(screen_pos: Vector2, viewport: Vector2) -> Array[int]:
	var id := pick_at(screen_pos)
	if id == 0:
		return []
	var pivot: IdEntity = world.get_entity(id)
	if pivot == null:
		return []
	var out: Array[int] = []
	var screen_rect := Rect2(Vector2.ZERO, viewport)
	for e in world.entities:
		if not e.alive or e.player != player_index or e.def_id != pivot.def_id:
			continue
		var world_pos := Vector3(e.x, cam.terrain.height_at(e.x, e.y), e.y)
		if cam.is_position_behind(world_pos):
			continue
		if screen_rect.has_point(cam.unproject_position(world_pos)):
			out.append(e.id)
	return out


# ------------------------------------------------------------------- input

## Returns true when the event was consumed.
func handle_input(event: InputEvent, viewport: Vector2) -> bool:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			return _handle_left(mb, viewport)
		if mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed:
			return _handle_right(mb)
	elif event is InputEventMouseMotion and dragging:
		drag_end = (event as InputEventMouseMotion).position
		return true
	return false


func _handle_left(mb: InputEventMouseButton, viewport: Vector2) -> bool:
	if mb.pressed:
		if build_def != "":
			place_building(mb.position, mb.shift_pressed)
			return true
		if pending_command != "":
			_issue_pending(mb.position, mb.shift_pressed)
			return true
		if mb.double_click:
			select_ids(pick_same_type(mb.position, viewport), mb.shift_pressed)
			return true
		dragging = true
		drag_start = mb.position
		drag_end = mb.position
		return true

	if not dragging:
		return false
	dragging = false
	drag_end = mb.position
	if drag_start.distance_to(drag_end) < DRAG_THRESHOLD:
		var id := pick_at(mb.position)
		if id == 0:
			if not mb.shift_pressed:
				_deselect_all()
		else:
			select_ids([id], mb.shift_pressed)
	else:
		select_ids(pick_in_box(drag_start, drag_end), mb.shift_pressed)
	return true


func _handle_right(mb: InputEventMouseButton) -> bool:
	if build_def != "":
		build_def = ""
		return true
	if pending_command != "":
		pending_command = ""
		return true
	if selected.is_empty():
		return false
	var ground := cam.ground_at(mb.position)
	issue_order(Vector2(ground.x, ground.z), mb.position, mb.shift_pressed)
	return true


## Right-click means different things depending on what is under the cursor:
## an enemy is an attack, a friendly nanoframe is an assist, open ground is a
## move. Which is how every order in this kind of game gets given.
func issue_order(ground: Vector2, screen_pos: Vector2, queue: bool) -> void:
	var target := _entity_under(screen_pos)
	var units := selected_entities()
	if not units.is_empty() and sound != null:
		sound.play_ui("order")

	for e in units:
		if not queue:
			e.orders.clear()
			e.has_move_goal = false
			e.path = []
			e.active_job = {}

		if target != null and world.is_enemy(e, target):
			e.orders.append({"type": IdOrders.ATTACK, "targetId": target.id})
		elif target != null and target != e and float(e.def.get("buildPower", 0.0)) > 0.0:
			e.orders.append({"type": IdOrders.GUARD, "targetId": target.id})
		elif float(e.def.get("speed", 0.0)) > 0.0:
			e.orders.append({"type": IdOrders.MOVE, "x": ground.x, "y": ground.y})
		elif bool(e.def.get("factory", false)):
			# A factory cannot move, so a right-click sets its rally point.
			e.has_rally = true
			e.rally = ground


## Run the command the player armed with a hotkey at the point they clicked.
func _issue_pending(screen_pos: Vector2, queue: bool) -> void:
	var command := pending_command
	pending_command = ""
	var ground := cam.ground_at(screen_pos)
	var target := _entity_under(screen_pos)

	for e in selected_entities():
		if not queue:
			e.orders.clear()
			e.has_move_goal = false
			e.path = []
			e.active_job = {}
		match command:
			IdOrders.ATTACK_MOVE:
				if target != null and world.is_enemy(e, target):
					e.orders.append({"type": IdOrders.ATTACK, "targetId": target.id})
				else:
					e.orders.append({
						"type": IdOrders.ATTACK_MOVE, "x": ground.x, "y": ground.z,
					})
			IdOrders.PATROL:
				# A patrol runs between where the unit is and where it was
				# sent, which is how a patrol order is given in this kind of
				# game: one click, two ends.
				e.orders.append({
					"type": IdOrders.PATROL,
					"points": [Vector2(e.x, e.y), Vector2(ground.x, ground.z)],
					"index": 0,
				})
			IdOrders.GUARD:
				if target != null and target != e:
					e.orders.append({"type": IdOrders.GUARD, "targetId": target.id})
			IdOrders.RECLAIM:
				var wreck := _wreck_under(ground)
				if not wreck.is_empty():
					e.orders.append({"type": IdOrders.RECLAIM, "wreckId": wreck["id"]})
			IdOrders.REPAIR:
				if target != null and not world.is_enemy(e, target):
					e.orders.append({"type": IdOrders.REPAIR, "targetId": target.id})


## The wreck nearest a ground point, within a generous grab radius.
func _wreck_under(ground: Vector3) -> Dictionary:
	var best: Dictionary = {}
	var best_d: float = 90.0 * 90.0
	for w in world.wrecks:
		if float(w["metal_left"]) <= 0.0:
			continue
		var d: float = IdMath.dist2(ground.x, ground.z, w["x"], w["y"])
		if d < best_d:
			best_d = d
			best = w
	return best


## Any entity near the cursor, friendly or not.
func _entity_under(screen_pos: Vector2) -> IdEntity:
	var best: IdEntity = null
	var best_d: float = PICK_RADIUS * PICK_RADIUS
	for e in world.entities:
		if not e.alive:
			continue
		var world_pos := Vector3(e.x, cam.terrain.height_at(e.x, e.y) + e.radius * 0.6, e.y)
		if cam.is_position_behind(world_pos):
			continue
		var d: float = cam.unproject_position(world_pos).distance_squared_to(screen_pos)
		var reach: float = PICK_RADIUS + e.radius * 0.25
		if d < best_d and d < reach * reach:
			best_d = d
			best = e
	return best


# ---------------------------------------------------------------- building

## Where the currently held building would land, and whether it may.
func build_preview(screen_pos: Vector2) -> Dictionary:
	if build_def == "":
		return {}
	var ground := cam.ground_at(screen_pos)
	var def: Dictionary = IdUnitDefs.get_def(build_def, world.players[player_index].faction)
	var snapped: Dictionary = world.map.snap_footprint(
		ground.x, ground.z, int(def.get("footprint", 0))
	)
	snapped["ok"] = IdOrders.can_build_here(
		world, player_index, def, snapped["cx"], snapped["cy"]
	)
	snapped["def"] = def
	return snapped


## Commit the held structure at a screen position: the nearest selected
## builder takes the job and the rest guard it.
func place_building(screen_pos: Vector2, queue: bool) -> void:
	var preview := build_preview(screen_pos)
	if preview.is_empty() or not bool(preview["ok"]):
		return

	var builders: Array[IdEntity] = []
	for e in selected_entities():
		if float(e.def.get("buildPower", 0.0)) > 0.0 and not bool(e.def.get("factory", false)):
			builders.append(e)
	if builders.is_empty():
		return

	# The nearest builder takes the job; the rest assist it, which is how a
	# group of builders is meant to behave when you place one structure.
	builders.sort_custom(func(a, b):
		return (
			IdMath.dist2(a.x, a.y, preview["x"], preview["y"])
			< IdMath.dist2(b.x, b.y, preview["x"], preview["y"])
		))

	var order := {
		"type": IdOrders.BUILD, "defId": build_def,
		"x": preview["x"], "y": preview["y"],
		"cx": preview["cx"], "cy": preview["cy"],
	}
	var lead: IdEntity = builders[0]
	if not queue:
		lead.orders.clear()
	lead.orders.append(order)
	for i in range(1, builders.size()):
		var b: IdEntity = builders[i]
		if not queue:
			b.orders.clear()
		b.orders.append({"type": IdOrders.GUARD, "targetId": lead.id})

	if not queue:
		build_def = ""


## Queue a unit at every selected factory that can make it.
func queue_unit(def_id: String, count: int = 1) -> bool:
	var queued := false
	for f in selected_entities():
		if not bool(f.def.get("factory", false)):
			continue
		if not (f.def.get("build", []) as Array).has(def_id):
			continue
		var found := false
		for item in f.factory_queue:
			if String(item["defId"]) == def_id:
				item["count"] = int(item["count"]) + count
				found = true
				break
		if not found:
			f.factory_queue.append({"defId": def_id, "count": count, "origCount": count})
		queued = true
	return queued


## What the current selection can build: a builder offers structures, a
## factory offers units. The union, so a mixed selection shows both.
func buildable() -> Array[String]:
	var out: Array[String] = []
	for e in selected_entities():
		if e.under_construction:
			continue
		for id in e.def.get("build", []):
			if not out.has(id):
				out.append(id)
	return out
