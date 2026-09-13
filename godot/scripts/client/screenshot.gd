extends Node

## Renders the main scene for a few frames and saves a screenshot.
## Run with: --script is not used here; this is added as an autoload-style
## helper node by the shot scene.

@export var out_path: String = "user://shot.png"
@export var warmup_frames: int = 30

func _ready() -> void:
	var frames := warmup_frames
	while frames > 0:
		await get_tree().process_frame
		frames -= 1
	var img := get_viewport().get_texture().get_image()
	var err := img.save_png(out_path)
	if err != OK:
		push_error("failed to save screenshot: %d" % err)
	print("screenshot saved: %s (%dx%d)" % [out_path, img.get_width(), img.get_height()])
	get_tree().quit(0)
