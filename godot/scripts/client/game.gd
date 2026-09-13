extends Node3D

## The match: builds the world, drives the simulation at a fixed 30Hz, and
## keeps the scene in step with it.
##
## The simulation runs on its own clock. Frames are drawn as fast as the
## machine manages, and each one syncs the scene to whatever the last tick
## produced; nothing in the scene tree can change the outcome of a match.

const CATCH_UP_LIMIT: int = 5  ## ticks a single frame may run before giving up

@export var map_seed: int = 12345
@export var player_faction: String = "vanguard"
@export var enemy_faction: String = "legion"

var world: IdWorld
var terrain: IdTerrainBuilder
var units: IdUnitView
var cam: IdRtsCamera

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


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg == "--ai":
			_autoplay = true

	var t0 := Time.get_ticks_msec()
	world = IdWorld.new({
		"seed": map_seed,
		"players": [
			{
				"name": "Vanguard AI" if _autoplay else "Commander",
				"faction": player_faction,
				"is_ai": _autoplay, "ai_level": "normal",
			},
			{"name": "Legion AI", "faction": enemy_faction, "is_ai": true, "ai_level": "normal"},
		],
	})
	terrain = IdTerrainBuilder.new(world.map, 2)
	print("world generated in %dms" % (Time.get_ticks_msec() - t0))

	IdSceneSetup.build_environment(self)
	IdSceneSetup.build_terrain(self, terrain)
	IdSceneSetup.build_water(self, world.map, terrain)

	units = IdUnitView.new()
	units.name = "Units"
	add_child(units)
	units.setup(world, terrain)

	cam = IdRtsCamera.new()
	cam.name = "Camera"
	add_child(cam)
	var me: IdPlayer = world.players[0]
	cam.setup(terrain, Vector2(me.start_x, me.start_y))
	cam.make_current()

	_parse_cmdline()
	units.sync()
	print("match ready: %d entities" % world.entities.size())


func _parse_cmdline() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--ticks="):
			_headless_ticks = int(arg.substr(8))
		elif arg.begins_with("--shot="):
			var helper := preload("res://scripts/client/screenshot.gd").new()
			helper.out_path = arg.substr(7)
			add_child(helper)


func _process(dt: float) -> void:
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
		units.sync()
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

	var viewport: Vector2 = get_viewport().get_visible_rect().size
	cam.update(dt, viewport, get_viewport().get_mouse_position())


func _unhandled_input(event: InputEvent) -> void:
	if cam.handle_input(event):
		return
	if event is InputEventKey and event.pressed and not event.echo:
		match (event as InputEventKey).keycode:
			KEY_SPACE:
				running = not running
			KEY_EQUAL, KEY_KP_ADD:
				speed = minf(speed * 2.0, 8.0)
			KEY_MINUS, KEY_KP_SUBTRACT:
				speed = maxf(speed * 0.5, 0.25)
			KEY_ESCAPE:
				get_tree().quit()


## Per-frame diagnostics, for the HUD and the automated checks.
func stats() -> Dictionary:
	return {
		"time": world.time,
		"ticks": _ticks_run,
		"sim_ms": _sim_ms,
		"entities": world.entities.size(),
		"projectiles": world.projectiles.size(),
		"fps": Engine.get_frames_per_second(),
	}


func _exit_tree() -> void:
	if world != null:
		world.dispose()
