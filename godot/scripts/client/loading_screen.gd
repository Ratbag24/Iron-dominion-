class_name IdLoadingScreen
extends CanvasLayer

## A full-screen message shown while the map is being generated.
##
## It exists because map generation takes a couple of seconds and a window
## that simply stops responding for that long looks broken. The generator runs
## on its own thread; this is what the player looks at meanwhile.

const BG := Color(0.035, 0.05, 0.075)
const TEXT := Color(0.86, 0.91, 0.97)
const DIM := Color(0.42, 0.72, 1.0)

var _label: Label
var _dots: Label
var _elapsed: float = 0.0


func _ready() -> void:
	layer = 100

	var bg := ColorRect.new()
	bg.color = BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER, true)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.custom_minimum_size = Vector2(520, 0)
	box.add_theme_constant_override("separation", 10)
	add_child(box)

	_label = Label.new()
	_label.add_theme_font_size_override("font_size", 26)
	_label.add_theme_color_override("font_color", TEXT)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_label)

	_dots = Label.new()
	_dots.add_theme_font_size_override("font_size", 20)
	_dots.add_theme_color_override("font_color", DIM)
	_dots.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_dots)


func show_message(text: String) -> void:
	if _label != null:
		_label.text = text
	else:
		# _ready has not run yet; remember it for when it does.
		call_deferred("show_message", text)


func _process(dt: float) -> void:
	_elapsed += dt
	if _dots != null:
		_dots.text = ".".repeat(1 + (int(_elapsed * 3.0) % 3))
