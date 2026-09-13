extends Control

## The front end: pick a faction, an opponent, a difficulty and a map, then
## start the match.
##
## The settings are handed to the game scene through IdMatchSettings rather
## than through exported properties, so nothing here needs a reference to the
## scene it is about to load.

const TITLE := "IRON DOMINION"
const SUBTITLE := "A real-time strategy game in the Beyond All Reason tradition"

const BG := Color(0.035, 0.05, 0.075)
const PANEL_BG := Color(0.065, 0.088, 0.128, 0.95)
const PANEL_EDGE := Color(0.35, 0.55, 0.78, 0.5)
const TEXT := Color(0.86, 0.91, 0.97)
const DIM := Color(0.55, 0.62, 0.72)
const ACCENT := Color(0.42, 0.72, 1.0)

var _faction: String = "vanguard"
var _enemy: String = "legion"
var _difficulty: String = "normal"
var _seed: int = 12345

var _faction_blurb: Label
var _enemy_blurb: Label
var _seed_label: Label
var _faction_buttons: Dictionary = {}
var _enemy_buttons: Dictionary = {}


func _ready() -> void:
	# The automated render and smoke-test paths address the match directly, so
	# the menu steps out of the way rather than having to be clicked through.
	for arg in OS.get_cmdline_user_args():
		if arg == "--play" or arg.begins_with("--ticks=") or arg.begins_with("--shot="):
			_start.call_deferred()
			return

	set_anchors_preset(Control.PRESET_FULL_RECT)
	_seed = int(Time.get_unix_time_from_system()) & 0xFFFFF

	var bg := ColorRect.new()
	bg.color = BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	var centre := VBoxContainer.new()
	centre.set_anchors_preset(Control.PRESET_CENTER, true)
	centre.grow_horizontal = Control.GROW_DIRECTION_BOTH
	centre.grow_vertical = Control.GROW_DIRECTION_BOTH
	centre.custom_minimum_size = Vector2(720, 0)
	centre.add_theme_constant_override("separation", 14)
	add_child(centre)

	centre.add_child(_heading(TITLE, 44, TEXT))
	centre.add_child(_heading(SUBTITLE, 14, DIM))
	centre.add_child(_spacer(10))

	# --- your faction -----------------------------------------------------
	centre.add_child(_section("YOUR FACTION"))
	var mine := HBoxContainer.new()
	mine.add_theme_constant_override("separation", 8)
	centre.add_child(mine)
	for id in IdUnitDefs.faction_ids():
		var b := _choice_button(IdUnitDefs.faction(id)["name"])
		b.pressed.connect(_pick_faction.bind(id))
		mine.add_child(b)
		_faction_buttons[id] = b
	_faction_blurb = _heading("", 13, DIM)
	centre.add_child(_faction_blurb)

	# --- opponent ---------------------------------------------------------
	centre.add_child(_spacer(6))
	centre.add_child(_section("OPPONENT"))
	var theirs := HBoxContainer.new()
	theirs.add_theme_constant_override("separation", 8)
	centre.add_child(theirs)
	for id in IdUnitDefs.faction_ids():
		var b := _choice_button(IdUnitDefs.faction(id)["name"])
		b.pressed.connect(_pick_enemy.bind(id))
		theirs.add_child(b)
		_enemy_buttons[id] = b
	_enemy_blurb = _heading("", 13, DIM)
	centre.add_child(_enemy_blurb)

	# --- difficulty and map ----------------------------------------------
	centre.add_child(_spacer(6))
	centre.add_child(_section("DIFFICULTY"))
	var levels := HBoxContainer.new()
	levels.add_theme_constant_override("separation", 8)
	centre.add_child(levels)
	var difficulty_group := ButtonGroup.new()
	for id in ["easy", "normal", "hard"]:
		var b := _choice_button(id.capitalize())
		b.button_group = difficulty_group
		b.button_pressed = id == _difficulty
		b.pressed.connect(func(): _difficulty = id)
		levels.add_child(b)

	centre.add_child(_spacer(6))
	var map_row := HBoxContainer.new()
	map_row.add_theme_constant_override("separation", 10)
	centre.add_child(map_row)
	_seed_label = _heading("", 14, TEXT)
	_seed_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	map_row.add_child(_seed_label)
	var reroll := Button.new()
	reroll.text = "New map"
	reroll.custom_minimum_size = Vector2(120, 34)
	reroll.pressed.connect(func():
		_seed = randi() & 0xFFFFF
		_refresh())
	map_row.add_child(reroll)

	# --- start ------------------------------------------------------------
	centre.add_child(_spacer(14))
	var start := Button.new()
	start.text = "START MATCH"
	start.custom_minimum_size = Vector2(0, 48)
	start.add_theme_font_size_override("font_size", 18)
	start.pressed.connect(_start)
	centre.add_child(start)

	var hint := _heading(
		"WASD or screen edge to pan   ·   wheel to zoom   ·   right-click to order"
		+ "   ·   space to pause   ·   H to halt",
		12, DIM
	)
	centre.add_child(_spacer(8))
	centre.add_child(hint)

	_refresh()


func _heading(text: String, font_size: int, colour: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", colour)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


func _section(text: String) -> Label:
	var l := _heading(text, 12, ACCENT)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	return l


func _spacer(height: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, height)
	return c


func _choice_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.toggle_mode = true
	b.custom_minimum_size = Vector2(0, 38)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# The default pressed state is darker than the unpressed one, which reads
	# as disabled rather than chosen.
	b.add_theme_stylebox_override("pressed", _selected_style())
	b.add_theme_color_override("font_pressed_color", TEXT)
	b.add_theme_color_override("font_hover_pressed_color", TEXT)
	return b


func _selected_style() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.24, 0.40)
	sb.border_color = ACCENT
	sb.set_border_width_all(1)
	sb.border_width_bottom = 3
	sb.set_corner_radius_all(3)
	sb.set_content_margin_all(6)
	return sb


func _pick_faction(id: String) -> void:
	_faction = id
	# The two sides may share a faction, but defaulting the opponent to a
	# different one makes for a more interesting first match.
	if _enemy == _faction:
		for other in IdUnitDefs.faction_ids():
			if other != _faction:
				_enemy = other
				break
	_refresh()


func _pick_enemy(id: String) -> void:
	_enemy = id
	_refresh()


func _refresh() -> void:
	for id in _faction_buttons:
		_faction_buttons[id].button_pressed = id == _faction
	for id in _enemy_buttons:
		_enemy_buttons[id].button_pressed = id == _enemy
	_faction_blurb.text = String(IdUnitDefs.faction(_faction).get("blurb", ""))
	_enemy_blurb.text = String(IdUnitDefs.faction(_enemy).get("blurb", ""))
	_seed_label.text = "Map seed %d" % _seed


func _start() -> void:
	IdMatchSettings.player_faction = _faction
	IdMatchSettings.enemy_faction = _enemy
	IdMatchSettings.difficulty = _difficulty
	IdMatchSettings.map_seed = _seed
	get_tree().change_scene_to_file("res://scenes/game.tscn")
