class_name IdMinimap
extends Control

## The map at a glance: terrain, what we have explored, where everything is,
## and where the camera is pointing. Click or drag to move the view.
##
## The terrain is baked to a texture once; everything drawn on top of it is
## redrawn each frame from the world, because all of it moves.

const SIZE: float = 196.0
const UNEXPLORED := Color(0.02, 0.03, 0.05, 0.92)
const UNSEEN := Color(0.02, 0.03, 0.05, 0.45)
const VIEWPORT_EDGE := Color(0.92, 0.95, 1.0, 0.85)
const METAL_SPOT := Color(0.85, 0.88, 0.94, 0.75)

var world: IdWorld
var cam: IdRtsCamera
var viewer: int = 0

var _texture: ImageTexture
var _team_colours: Array[Color] = []
var _dragging: bool = false

## Fog is baked into its own small texture rather than drawn cell by cell:
## the fog grid is around a hundred cells square, and a rectangle each would
## be nine thousand draw calls a frame for something that barely changes.
var _fog_image: Image
var _fog_texture: ImageTexture
var _fog_version: int = -1


func setup(
	w: IdWorld, terrain: IdTerrainBuilder, c: IdRtsCamera, viewer_index: int,
	prebuilt: Image = null
) -> void:
	world = w
	cam = c
	viewer = viewer_index
	_texture = ImageTexture.create_from_image(
		prebuilt if prebuilt != null else terrain.minimap_image(192)
	)
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	if viewer_index >= 0:
		var fog: IdFogMap = w.fog[viewer_index]
		_fog_image = Image.create(fog.cols, fog.rows, false, Image.FORMAT_RGBA8)
		_fog_texture = ImageTexture.create_from_image(_fog_image)
	custom_minimum_size = Vector2(SIZE, SIZE)
	size = Vector2(SIZE, SIZE)
	# A camera looking towards the horizon puts its far corners a long way
	# off the map, and an unclipped Control happily draws them across the
	# rest of the screen.
	clip_contents = true
	for p in w.players:
		_team_colours.append(Color(p.color["primary"]))


func _world_to_map(x: float, y: float) -> Vector2:
	return Vector2(x / world.map.width * SIZE, y / world.map.height * SIZE)


func _map_to_world(p: Vector2) -> Vector2:
	return Vector2(
		clampf(p.x / SIZE, 0.0, 1.0) * world.map.width,
		clampf(p.y / SIZE, 0.0, 1.0) * world.map.height
	)


func _draw() -> void:
	if world == null:
		return
	draw_texture_rect(_texture, Rect2(Vector2.ZERO, Vector2(SIZE, SIZE)), false)
	_draw_fog()
	_draw_metal_spots()
	_draw_entities()
	_draw_viewport_box()
	draw_rect(Rect2(Vector2.ZERO, Vector2(SIZE, SIZE)), Color(0.4, 0.55, 0.75, 0.6), false, 1.0)


## Unexplored ground is blacked out, explored-but-not-currently-seen is dimmed.
## Drawn as one rectangle per fog cell: at 32 world units a cell that is under
## a hundred rectangles across the whole map, which is cheaper than rebuilding
## a texture every frame.
func _draw_fog() -> void:
	if viewer < 0:
		return
	var fog: IdFogMap = world.fog[viewer]
	if fog.version != _fog_version:
		_fog_version = fog.version
		for gy in range(fog.rows):
			for gx in range(fog.cols):
				var i := gy * fog.cols + gx
				var colour: Color
				if fog.explored[i] == 0:
					colour = UNEXPLORED
				elif fog.visible_cells[i] == 0:
					colour = UNSEEN
				else:
					colour = Color(0, 0, 0, 0)
				_fog_image.set_pixel(gx, gy, colour)
		_fog_texture.update(_fog_image)
	draw_texture_rect(_fog_texture, Rect2(Vector2.ZERO, Vector2(SIZE, SIZE)), false)


func _draw_metal_spots() -> void:
	var fog: IdFogMap = world.fog[viewer] if viewer >= 0 else null
	for s in world.map.metal_spots:
		if fog != null and not fog.is_explored(s["x"], s["y"]):
			continue
		draw_rect(Rect2(_world_to_map(s["x"], s["y"]) - Vector2.ONE, Vector2(2, 2)), METAL_SPOT)


func _draw_entities() -> void:
	var fog: IdFogMap = world.fog[viewer] if viewer >= 0 else null
	var viewer_team: int = world.players[viewer].team if viewer >= 0 else -1

	# Remembered enemy structures stay on the minimap under fog, which is what
	# makes scouting worth doing.
	if fog != null:
		for id in fog.memory:
			var mem: Dictionary = fog.memory[id]
			var at := _world_to_map(mem["x"], mem["y"])
			draw_rect(Rect2(at - Vector2.ONE * 1.5, Vector2(3, 3)),
				_team_colours[mem["player"]].darkened(0.35))

	for e in world.entities:
		if not e.alive:
			continue
		var friendly: bool = viewer < 0 or world.players[e.player].team == viewer_team
		if not friendly and fog != null and not fog.is_visible_at(e.x, e.y):
			continue
		var at := _world_to_map(e.x, e.y)
		var r: float = 2.5 if e.is_building else 1.5
		var colour: Color = _team_colours[e.player]
		if e.selected:
			colour = Color.WHITE
		draw_rect(Rect2(at - Vector2.ONE * r, Vector2.ONE * r * 2.0), colour)


## The camera's footprint, from the ground under the four screen corners.
func _draw_viewport_box() -> void:
	var screen: Vector2 = get_viewport().get_visible_rect().size
	var corners: Array[Vector2] = []
	var bound := SIZE * 3.0
	for c in [Vector2(0, 0), Vector2(screen.x, 0), screen, Vector2(0, screen.y)]:
		var ground := cam.ground_at(c)
		var at := _world_to_map(ground.x, ground.z)
		# Keep the corner finite even when the ray was nearly parallel to the
		# ground; clip_contents cuts it back to the panel.
		corners.append(Vector2(
			clampf(at.x, -bound, bound), clampf(at.y, -bound, bound)
		))
	for i in range(4):
		draw_line(corners[i], corners[(i + 1) % 4], VIEWPORT_EDGE, 1.0)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_dragging = mb.pressed
			if mb.pressed:
				_jump_to(mb.position)
			accept_event()
	elif event is InputEventMouseMotion and _dragging:
		_jump_to((event as InputEventMouseMotion).position)
		accept_event()


func _jump_to(local: Vector2) -> void:
	var target := _map_to_world(local)
	cam.focus_on(target)
