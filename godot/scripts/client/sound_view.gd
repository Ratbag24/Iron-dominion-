class_name IdSoundView
extends Node3D

## Turns simulation events into sound.
##
## It reads the same effects list the visuals do, so a shot that is drawn is a
## shot that is heard and nothing has to be emitted twice. Players come from a
## fixed pool: a battle can produce a hundred events in a frame and starting a
## hundred voices would cost more than the rest of the frame put together, and
## would sound like static rather than like a battle.

const VOICES: int = 24
const MAX_PER_FRAME: int = 5
const HEARING_RANGE: float = 2200.0

## Minimum seconds between two of the same sound, so a volley of eight guns is
## one crack rather than eight stacked on the same sample.
const REPEAT_GAP: float = 0.055

var world: IdWorld
var terrain: IdTerrainBuilder
var viewer: int = 0
var enabled: bool = true

var _players: Array[AudioStreamPlayer3D] = []
var _next: int = 0
var _last_played: Dictionary = {}
var _seen_until: float = 0.0


func setup(w: IdWorld, t: IdTerrainBuilder, viewer_index: int = 0) -> void:
	world = w
	terrain = t
	viewer = viewer_index
	IdAudioBank.warm()

	for i in range(VOICES):
		var p := AudioStreamPlayer3D.new()
		p.max_distance = HEARING_RANGE
		p.unit_size = 260.0
		p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		add_child(p)
		_players.append(p)


## Play whatever has happened since the last frame. Events carry the time they
## were raised, which is what lets this pick up only the new ones without the
## simulation having to know a renderer exists.
func sync() -> void:
	if not enabled or world.effects.is_empty():
		return
	var now := world.time
	var started := 0

	for fx in world.effects:
		var t := float(fx["t"])
		if t <= _seen_until:
			continue
		if started >= MAX_PER_FRAME:
			break
		var name := _sound_for(fx)
		if name == "":
			continue
		var x: float = fx["x"]
		var y: float = fx["y"]
		if viewer >= 0 and not world.fog[viewer].is_visible_at(x, y):
			continue
		if _play(name, x, y, now):
			started += 1

	_seen_until = now


func _sound_for(fx: Dictionary) -> String:
	match String(fx["type"]):
		"muzzle":
			# Louder guns get heavier sounds; the size the effect carries is
			# derived from damage, so it already says how big the gun was.
			var size := float(fx.get("size", 8.0))
			if size > 18.0:
				return "artillery"
			if size > 11.0:
				return "cannon"
			return "laser"
		"explosion":
			if bool(fx.get("nuke", false)):
				return "explosion_huge"
			return "explosion_big" if bool(fx.get("big", false)) else "explosion_small"
		"buildStart":
			return "build_start"
		"buildDone":
			return "build_done"
		"unitDone":
			return "unit_done"
	return ""


func _play(name: String, x: float, y: float, now: float) -> bool:
	if now - float(_last_played.get(name, -99.0)) < REPEAT_GAP:
		return false
	_last_played[name] = now

	var p: AudioStreamPlayer3D = _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = IdAudioBank.get_sound(name)
	p.position = Vector3(x, terrain.height_at(x, y) + 12.0, y)
	# A little pitch variation, so repeated shots do not phase into a drone.
	p.pitch_scale = randf_range(0.92, 1.09)
	p.play()
	return true


## Interface sounds, which are not positional and play regardless of fog.
func play_ui(name: String) -> void:
	if not enabled:
		return
	var p: AudioStreamPlayer3D = _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = IdAudioBank.get_sound(name)
	# At the camera's focus, so it is heard at full volume wherever the view is.
	p.position = Vector3(0, 0, 0)
	if get_viewport() != null and get_viewport().get_camera_3d() != null:
		p.position = get_viewport().get_camera_3d().global_position
	p.pitch_scale = 1.0
	p.play()
