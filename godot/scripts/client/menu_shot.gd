extends SceneTree

## Renders the front end and saves a frame. The menu leaves the stage for the
## automated match paths, so it needs its own capture route.

func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var out := "user://menu.png"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			out = arg.substr(6)
	change_scene_to_file("res://scenes/menu.tscn")
	for _i in range(30):
		await process_frame
	var img := root.get_texture().get_image()
	var err := img.save_png(out)
	if err != OK:
		push_error("failed to save: %d" % err)
	print("menu shot saved: %s (%dx%d)" % [out, img.get_width(), img.get_height()])
	quit(0)
