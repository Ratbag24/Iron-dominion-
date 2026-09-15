extends Node3D

## The match: builds the world, drives the simulation at a fixed 30Hz, and
## keeps the scene in step with it.
##
## The simulation runs on its own clock. Frames are drawn as fast as the
## machine manages, and each one syncs the scene to whatever the last tick
## produced; nothing in the scene tree can change the outcome of a match.

const CATCH_UP_LIMIT: int = 5  ## ticks a single frame may run before giving up

## Taken from the front end when there is one, and from the defaults in
## IdMatchSettings when the scene is run on its own.
var map_seed: int = IdMatchSettings.map_seed
var player_faction: String = IdMatchSettings.player_faction
var difficulty: String = IdMatchSettings.difficulty

var world: IdWorld
var terrain: IdTerrainBuilder
var ground: IdGroundView
var units: IdUnitView
var cam: IdRtsCamera
var effects: IdEffectsView
var sound: IdSoundView
var selection: IdSelection
var hud: IdHud

var running: bool = true
var speed: float = 1.0
var _accumulator: float = 0.0
var _ticks_run: int = 0
var _sim_ms: float = 0.0

## Set from --ticks=N on the command line: run that many ticks and quit.
var _headless_ticks: int = 0
## --ai hands the first player to the AI as well, so a match plays itself.
## Used by the screenshot and smoke-test paths.
var _autoplay: bool = false
## --action points the camera at whatever is being shot at, for renders of a
## match already in progress.
var _focus_action: bool = false

## Generating a map takes a couple of seconds, so it runs on its own thread
## behind a loading screen rather than freezing the window. Nothing it touches
## is in the scene tree, which is what makes that safe.
var _loader: Thread
var _loading: IdLoadingScreen
var _generate_ms: int = 0
var _terrain_mesh: Mesh
var _minimap_image: Image

## Control groups, keyed by the number key that recalls them.
var _groups: Dictionary = {}
var _last_group: int = -1
var _last_group_time: int = 0


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg == "--ai":
			_autoplay = true
		elif arg.begins_with("--opponents="):
			IdMatchSettings.opponents = int(arg.substr(12))
		elif arg.begins_with("--sides="):
			IdMatchSettings.team_mode = arg.substr(8)
		elif arg == "--action":
			_focus_action = true
		# Which factions play, for renders of a particular match-up.
		elif arg.begins_with("--player="):
			IdMatchSettings.player_faction = arg.substr(9)
		elif arg.begins_with("--enemy="):
			IdMatchSettings.enemy_faction = arg.substr(8)

	_loading = IdLoadingScreen.new()
	_loading.name = "Loading"
	add_child(_loading)
	_loading.show_message("Generating map")

	# Not every build has threads. A web export without them cannot be given
	# work on one — Thread.start simply never runs it, and the loading screen
	# waits for a result that will not come. Where that is the case the map is
	# generated on the main thread instead, a frame later so the screen has
	# had a chance to paint first. It blocks rather than animating, which is
	# the honest trade for running at all.
	if OS.has_feature("threads"):
		_loader = Thread.new()
		_loader.start(_generate)
	else:
		_generate_on_main.call_deferred()


## Runs off the main thread: world generation and the ground mesh, neither of
## which touches the scene tree.
func _generate() -> void:
	var t0 := Time.get_ticks_msec()
	world = IdWorld.new({
		"seed": map_seed,
		"players": IdMatchSettings.player_specs(_autoplay),
	})
	terrain = IdTerrainBuilder.new(world.map, 2)
	# The ground mesh and the minimap are the two most expensive things left,
	# so they are built here rather than on the far side of the loading screen.
	_terrain_mesh = terrain.build_mesh()
	_minimap_image = terrain.minimap_image(192)
	IdTerrainBuilder.detail_normal_image()
	# The ground textures are a second or two of noise generation: done here,
	# behind the loading screen, rather than as a stall when the match begins.
	IdSceneSetup.prepare_ground_textures()
	_generate_ms = Time.get_ticks_msec() - t0


## The fallback path: generate here, then build, without a thread anywhere.
func _generate_on_main() -> void:
	# One more frame so the loading screen is actually on screen before the
	# main loop stops answering.
	await get_tree().process_frame
	_generate()
	_build_scene()


func _build_scene() -> void:
	if _loader != null:
		_loader.wait_to_finish()
		_loader = null
	_loading.queue_free()
	_loading = null
	print("world generated in %dms" % _generate_ms)

	IdSceneSetup.build_environment(self)
	var ground_mesh := IdSceneSetup.build_terrain(self, terrain, false, _terrain_mesh)
	IdSceneSetup.build_water(self, world.map, terrain)

	ground = IdGroundView.new()
	ground.name = "Ground"
	add_child(ground)
	ground.setup(world, ground_mesh.material_override as ShaderMaterial)

	units = IdUnitView.new()
	units.name = "Units"
	add_child(units)
	# A self-playing render sees everything; a real match sees what the local
	# player's units and radar can.
	units.setup(world, terrain, -1 if _autoplay else 0)

	effects = IdEffectsView.new()
	effects.name = "Effects"
	add_child(effects)
	effects.setup(world, terrain, -1 if _autoplay else 0)

	sound = IdSoundView.new()
	sound.name = "Sound"
	add_child(sound)
	sound.setup(world, terrain, -1 if _autoplay else 0)

	cam = IdRtsCamera.new()
	cam.name = "Camera"
	add_child(cam)
	var me: IdPlayer = world.players[0]
	cam.setup(terrain, Vector2(me.start_x, me.start_y))
	cam.make_current()

	selection = IdSelection.new()
	selection.setup(world, cam, 0)
	selection.sound = sound

	if not _autoplay:
		hud = IdHud.new()
		hud.name = "Hud"
		add_child(hud)
		hud.setup(world, selection, self, terrain, _minimap_image)
		# Start with the commander picked, so the first click has something to
		# build with rather than an empty palette.
		selection.select_ids([me.commander_id], false)

	_parse_cmdline()
	units.sync()
	print("match ready: %d entities" % world.entities.size())


## Centre the view on the fighting: the average of everything that has been
## shot at or blown up recently, falling back to the midpoint between the two
## starts when the map is quiet.
func _look_at_the_fighting() -> void:
	var sum := Vector2.ZERO
	var count := 0
	for e in world.entities:
		if not e.alive or world.time - e.last_damage_time > 12.0:
			continue
		sum += Vector2(e.x, e.y)
		count += 1
	for fx in world.effects:
		if String(fx["type"]) != "explosion":
			continue
		sum += Vector2(fx["x"], fx["y"])
		count += 1

	var centre: Vector2
	if count > 0:
		centre = sum / float(count)
	else:
		centre = Vector2(world.map.width * 0.5, world.map.height * 0.5)
	cam.distance = 520.0
	cam.setup(terrain, centre)
	print("focus: %s (%d contacts)" % [str(centre.round()), count])


func _parse_cmdline() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--ticks="):
			_headless_ticks = int(arg.substr(8))
		elif arg.begins_with("--shot="):
			var helper := preload("res://scripts/client/screenshot.gd").new()
			helper.out_path = arg.substr(7)
			add_child(helper)


func _process(dt: float) -> void:
	if _loading != null:
		# is_alive is the thread's own answer, rather than a flag it sets and
		# this side hopes to see. Without a thread, _generate_on_main clears
		# the loading screen itself and this never fires.
		if _loader != null and not _loader.is_alive():
			_build_scene()
		return

	if _headless_ticks > 0:
		# Deterministic path for screenshots and automated checks: run a fixed
		# number of ticks in one go rather than chasing wall-clock time.
		var started := Time.get_ticks_usec()
		for _i in range(_headless_ticks):
			world.tick()
			_ticks_run += 1
			if world.game_over:
				break
		_sim_ms = float(Time.get_ticks_usec() - started) / 1000.0
		print("ran %d ticks (%.0f simulated seconds) in %.0fms"
			% [_ticks_run, world.time, _sim_ms])
		_headless_ticks = 0
		if _focus_action:
			_look_at_the_fighting()
		units.sync()
		effects.sync()
		ground.sync()
		return

	if running and not world.game_over:
		_accumulator += dt * speed
		var ran := 0
		var started := Time.get_ticks_usec()
		while _accumulator >= IdWorld.SIM_DT and ran < CATCH_UP_LIMIT:
			world.tick()
			_accumulator -= IdWorld.SIM_DT
			ran += 1
			_ticks_run += 1
		if ran > 0:
			_sim_ms = float(Time.get_ticks_usec() - started) / 1000.0 / float(ran)
		if ran == CATCH_UP_LIMIT:
			# Too far behind to catch up. Drop the backlog rather than
			# spiralling, so the game slows down instead of freezing.
			_accumulator = 0.0

	units.sync()
	effects.sync()
	sound.sync()

	var viewport: Vector2 = get_viewport().get_visible_rect().size
	cam.update(dt, viewport, get_viewport().get_mouse_position())

	if hud != null:
		selection.prune()
		hud.refresh()


func _unhandled_input(event: InputEvent) -> void:
	var viewport: Vector2 = get_viewport().get_visible_rect().size

	if event is InputEventKey:
		var key := event as InputEventKey
		# Hold the modifier for a right-drag rotate, so a plain right-click
		# stays an order.
		if key.keycode == KEY_ALT:
			cam.set_rotating(key.pressed)
		if key.pressed and not key.echo and _handle_key(key):
			return

	if hud != null and selection.handle_input(event, viewport):
		return
	if cam.handle_input(event):
		return


func _handle_key(key: InputEventKey) -> bool:
	match key.keycode:
		KEY_SPACE:
			running = not running
			return true
		KEY_M:
			sound.enabled = not sound.enabled
			return true
		KEY_EQUAL, KEY_KP_ADD:
			speed = minf(speed * 2.0, 8.0)
			return true
		KEY_MINUS, KEY_KP_SUBTRACT:
			speed = maxf(speed * 0.5, 0.25)
			return true
		KEY_H:
			# Jump to the commander, which is where you want to be whenever
			# something has gone wrong somewhere else.
			var com: IdEntity = world.get_entity(world.players[0].commander_id)
			if com != null:
				cam.focus_on(Vector2(com.x, com.y))
			return true
		KEY_HOME:
			cam.distance = 700.0
			cam.yaw = 0.0
			cam.pitch = 0.92
			cam.focus_on(Vector2(world.players[0].start_x, world.players[0].start_y))
			return true
		KEY_BRACKETLEFT:
			cam.yaw -= 0.18
			cam.focus_on(Vector2(cam.focus.x, cam.focus.z))
			return true
		KEY_BRACKETRIGHT:
			cam.yaw += 0.18
			cam.focus_on(Vector2(cam.focus.x, cam.focus.z))
			return true
		KEY_TAB:
			return _select_next_idle_builder()
		KEY_ESCAPE:
			if selection != null and selection.build_def != "":
				selection.build_def = ""
				return true
			get_tree().change_scene_to_file("res://scenes/menu.tscn")
			return true
		KEY_S:
			# Stop.
			if selection == null:
				return false
			selection.pending_command = ""
			selection.build_def = ""
			for e in selection.selected_entities():
				e.orders.clear()
				e.has_move_goal = false
				e.path = []
			return true

	# Commands that need a target: the key arms them, the next click runs them.
	if selection != null:
		var command := _command_for(key.keycode)
		if command != "":
			selection.build_def = ""
			selection.pending_command = command
			return true

	# Number keys are control groups, as in every game of this kind.
	if key.keycode >= KEY_0 and key.keycode <= KEY_9:
		return _control_group(key.keycode - KEY_0, key.ctrl_pressed, key.shift_pressed)

	# Everything else goes to the build palette, whose keys are in the shared
	# data file so a faction's equivalent structure sits on the same one.
	if hud != null and key.keycode >= KEY_A and key.keycode <= KEY_Z:
		return hud.press_hotkey(char(key.keycode).to_upper())
	return false


## Ctrl assigns the current selection to a group, shift adds it to the current
## selection, and a bare press selects it. Pressing the same group twice in
## quick succession jumps the camera to it. The keys match the browser build's,
## so the two are not two different games to learn.
## Cycle through builders with nothing to do. An idle builder is wasted build
## power, and in a game this size they are easy to lose track of.
func _select_next_idle_builder() -> bool:
	if selection == null:
		return false
	var idle: Array[IdEntity] = []
	for e in world.units_of(0):
		if e.under_construction or e.is_building:
			continue
		if float(e.def.get("buildPower", 0.0)) <= 0.0:
			continue
		if bool(e.def.get("assistOnly", false)) or bool(e.def.get("factory", false)):
			continue
		if e.orders.is_empty():
			idle.append(e)
	if idle.is_empty():
		return true

	# Start from the one after whichever is selected, so repeated presses walk
	# the list rather than sticking on the first.
	var start := 0
	for i in range(idle.size()):
		if selection.selected.has(idle[i].id):
			start = i + 1
			break
	var pick: IdEntity = idle[start % idle.size()]
	selection.select_ids([pick.id], false)
	cam.focus_on(Vector2(pick.x, pick.y))
	return true


## The commands that wait for a click. These keys are the ones the shared data
## file deliberately keeps clear of the build menu.
func _command_for(keycode: int) -> String:
	match keycode:
		KEY_A: return IdOrders.ATTACK_MOVE
		KEY_D: return IdOrders.GUARD
		KEY_F: return IdOrders.PATROL
		KEY_E: return IdOrders.RECLAIM
		KEY_R: return IdOrders.REPAIR
	return ""


func _control_group(index: int, assign: bool, additive: bool) -> bool:
	if selection == null:
		return false
	if assign:
		_groups[index] = selection.selected.duplicate()
		return true

	var ids: Array = _groups.get(index, [])
	if ids.is_empty():
		return false

	var live: Array[int] = []
	for id in ids:
		if world.get_entity(id) != null:
			live.append(id)
	_groups[index] = live
	if live.is_empty():
		return true

	selection.select_ids(live, additive)

	var now := Time.get_ticks_msec()
	if index == _last_group and now - _last_group_time < 400:
		_centre_on(live)
	_last_group = index
	_last_group_time = now
	return true


func _centre_on(ids: Array) -> void:
	var sum := Vector2.ZERO
	var count := 0
	for id in ids:
		var e: IdEntity = world.get_entity(id)
		if e == null:
			continue
		sum += Vector2(e.x, e.y)
		count += 1
	if count > 0:
		cam.focus_on(sum / float(count))


## Per-frame diagnostics, for the HUD and the automated checks.
func stats() -> Dictionary:
	return {
		"time": world.time,
		"ticks": _ticks_run,
		"sim_ms": _sim_ms,
		"entities": world.entities.size(),
		"projectiles": world.projectiles.size(),
		"fps": Engine.get_frames_per_second(),
		"paused": not running,
		"speed": speed,
		"sound": sound == null or sound.enabled,
	}


func _exit_tree() -> void:
	if world != null:
		world.dispose()
