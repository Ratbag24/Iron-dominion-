extends SceneTree

## Renders a frame with units selected, a queue of orders and a command armed.
##
## The plain --shot path cannot show any of that: it starts a match and walks
## away, so nothing is ever selected and no order is ever given. This drives
## the interface into the state worth looking at and then captures it.

func _init() -> void:
	_run.call_deferred()

func _run() -> void:
	var out := "user://orders.png"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			out = arg.substr(6)
	change_scene_to_file("res://scenes/game.tscn")
	for _i in range(8):
		await process_frame

	var game: Node = root.get_child(root.get_child_count() - 1)
	# The world is generated on its own thread, and the interface does not
	# exist until it lands.
	while game.get("selection") == null:
		await process_frame
	var world: IdWorld = game.world
	for _i in range(60 * 30):
		world.tick()

	var sel: IdSelection = game.selection
	var ids: Array[int] = []
	for e in world.units_of(0):
		if float(e.def.get("speed", 0.0)) > 0.0:
			ids.append(e.id)
	if ids.is_empty():
		ids.append(world.players[0].commander_id)
	sel.select_ids(ids, false)

	var me: IdPlayer = world.players[0]
	for e in sel.selected_entities():
		e.orders.clear()
		e.orders.append({"type": IdOrders.MOVE, "x": me.start_x + 280.0, "y": me.start_y + 120.0})
		e.orders.append({"type": IdOrders.ATTACK_MOVE, "x": me.start_x + 60.0, "y": me.start_y + 420.0})
	sel.pending_command = IdOrders.ATTACK_MOVE

	for _i in range(20):
		await process_frame
	var img := root.get_texture().get_image()
	img.save_png(out)
	print("orders shot saved: %s" % out)
	quit(0)
