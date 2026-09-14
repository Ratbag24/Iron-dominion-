class_name IdHud
extends CanvasLayer

## The interface layer: resource readouts, the selection panel, the build
## palette, and the overlay that draws selection rings and the drag box.
##
## Everything here reads the world and never writes to it. Orders are issued
## through IdSelection, which is the only thing allowed to touch entities.

const PANEL_BG := Color(0.055, 0.075, 0.11, 0.88)
const PANEL_EDGE := Color(0.35, 0.55, 0.78, 0.45)
const TEXT := Color(0.86, 0.91, 0.97)
const TEXT_DIM := Color(0.55, 0.62, 0.72)
const METAL := Color(0.72, 0.78, 0.86)
const ENERGY := Color(1.0, 0.82, 0.35)
const STALL := Color(1.0, 0.42, 0.35)
const OK := Color(0.42, 0.86, 0.55)

var world: IdWorld
var selection: IdSelection
var game: Node

var _overlay: Control
var _top: Label
var _info: Label
var _palette: HFlowContainer
var _palette_ids: Array[String] = []
var _minimap: IdMinimap
var _banner: Label
var _banner_panel: PanelContainer


func setup(
	w: IdWorld, sel: IdSelection, owner_game: Node, terrain: IdTerrainBuilder,
	minimap_image: Image = null
) -> void:
	world = w
	selection = sel
	game = owner_game
	_build()
	_build_minimap(terrain, minimap_image)
	_build_banner()


func _build() -> void:
	_overlay = Control.new()
	_overlay.name = "Overlay"
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay.draw.connect(_draw_overlay)
	add_child(_overlay)

	_top = _panelled_label(Control.PRESET_TOP_LEFT, Vector2(14, 12), 15)
	# Above the minimap, which occupies the bottom-left corner.
	_info = _panelled_label(Control.PRESET_BOTTOM_LEFT, Vector2(14, -318), 13)

	var palette_panel := PanelContainer.new()
	palette_panel.add_theme_stylebox_override("panel", _panel_style())
	# Anchored to the bottom-right corner and grown upwards and leftwards, so
	# the palette stays put as its contents wrap onto more rows.
	palette_panel.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT, true)
	palette_panel.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	palette_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	palette_panel.offset_right = -14
	palette_panel.offset_bottom = -14
	palette_panel.custom_minimum_size = Vector2(468, 0)
	add_child(palette_panel)

	_palette = HFlowContainer.new()
	_palette.add_theme_constant_override("h_separation", 6)
	_palette.add_theme_constant_override("v_separation", 6)
	palette_panel.add_child(_palette)


## A label inside its own panel, pinned to a corner and sized by its text.
## Laying it out by hand instead leaves it wherever the last anchor change put
## it, which is usually off the bottom of the screen.
func _panelled_label(preset: int, offset: Vector2, font_size: int) -> Label:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style())
	panel.set_anchors_preset(preset, true)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if offset.y < 0.0:
		panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
		panel.offset_bottom = offset.y
		panel.offset_top = offset.y
	else:
		panel.offset_top = offset.y
		panel.offset_bottom = offset.y
	panel.offset_left = offset.x
	panel.offset_right = offset.x
	add_child(panel)

	var l := Label.new()
	l.add_theme_color_override("font_color", TEXT)
	l.add_theme_font_size_override("font_size", font_size)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(l)
	# An empty panel would otherwise sit in the corner as a bare box.
	l.visibility_changed.connect(func(): panel.visible = l.visible)
	return l


func _build_minimap(terrain: IdTerrainBuilder, prebuilt: Image) -> void:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _panel_style())
	panel.set_anchors_preset(Control.PRESET_BOTTOM_LEFT, true)
	panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	panel.offset_left = 14
	panel.offset_right = 14
	panel.offset_top = -96
	panel.offset_bottom = -96
	add_child(panel)

	_minimap = IdMinimap.new()
	_minimap.setup(world, terrain, selection.cam, selection.player_index, prebuilt)
	panel.add_child(_minimap)


## The end-of-match message. Hidden until there is one.
func _build_banner() -> void:
	_banner_panel = PanelContainer.new()
	_banner_panel.add_theme_stylebox_override("panel", _panel_style())
	_banner_panel.set_anchors_preset(Control.PRESET_CENTER_TOP, true)
	_banner_panel.offset_top = 90
	_banner_panel.offset_bottom = 90
	_banner_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_banner_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner_panel.visible = false
	add_child(_banner_panel)

	_banner = Label.new()
	_banner.add_theme_font_size_override("font_size", 30)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner_panel.add_child(_banner)


func _refresh_banner() -> void:
	if not world.game_over:
		_banner_panel.visible = false
		return
	_banner_panel.visible = true
	var me: IdPlayer = world.players[selection.player_index]
	if world.winner == me.team:
		_banner.text = "VICTORY"
		_banner.add_theme_color_override("font_color", OK)
	elif world.winner < 0:
		_banner.text = "DRAW"
		_banner.add_theme_color_override("font_color", TEXT)
	else:
		_banner.text = "DEFEAT"
		_banner.add_theme_color_override("font_color", STALL)


func _panel_style() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = PANEL_BG
	sb.border_color = PANEL_EDGE
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(4)
	sb.set_content_margin_all(6)
	return sb


func _make_label(pos: Vector2, width: float) -> Label:
	var l := Label.new()
	l.position = pos
	l.size = Vector2(width, 90)
	l.add_theme_color_override("font_color", TEXT)
	l.add_theme_font_size_override("font_size", 13)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_y", 1)
	add_child(l)
	return l


func refresh() -> void:
	var p: IdPlayer = world.players[selection.player_index]

	var metal_line := "Metal  %s / %s   %+.1f/s" % [
		IdMath.short_num(p.metal), IdMath.short_num(p.metal_storage),
		p.metal_income - p.metal_drain,
	]
	var energy_line := "Energy %s / %s   %+.0f/s" % [
		IdMath.short_num(p.energy), IdMath.short_num(p.energy_storage),
		p.energy_income - p.energy_drain,
	]
	var flags := ""
	if p.stalling_metal:
		flags += "  METAL STALL"
	if p.stalling_energy:
		flags += "  ENERGY STALL"

	var stats: Dictionary = game.stats()
	_top.text = "%s\n%s%s\n%s   %d fps   %.1fms/tick" % [
		metal_line, energy_line, flags,
		_clock(world.time), int(stats["fps"]), float(stats["sim_ms"]),
	]
	_top.add_theme_color_override(
		"font_color", STALL if (p.stalling_metal or p.stalling_energy) else TEXT
	)

	_refresh_info()
	_refresh_palette()
	_refresh_banner()
	_overlay.queue_redraw()
	_minimap.queue_redraw()


func _clock(t: float) -> String:
	return "%d:%02d" % [int(t) / 60, int(t) % 60]


func _refresh_info() -> void:
	var units := selection.selected_entities()
	_info.visible = not units.is_empty()
	if units.is_empty():
		_info.text = ""
		return
	if units.size() == 1:
		var e: IdEntity = units[0]
		var line := "%s\n%d / %d hp" % [
			String(e.def.get("name", e.def_id)), int(e.hp), int(e.max_hp),
		]
		if e.under_construction:
			line += "   building %d%%" % int(e.build_progress * 100.0)
		if bool(e.def.get("factory", false)):
			var queued := 0
			for item in e.factory_queue:
				queued += int(item["count"])
			line += "\nqueue: %d" % queued
		if not e.orders.is_empty():
			line += "\norder: %s (%d queued)" % [
				String(e.orders[0].get("type", "?")), e.orders.size(),
			]
		_info.text = line
		return

	# A mixed selection is summarised by type, which is more use than a list.
	var by_type: Dictionary = {}
	for e in units:
		var key := String(e.def.get("name", e.def_id))
		by_type[key] = int(by_type.get(key, 0)) + 1
	var parts: Array[String] = []
	for key in by_type:
		parts.append("%d %s" % [by_type[key], key])
	_info.text = "%d selected\n%s" % [units.size(), ", ".join(parts)]


func _refresh_palette() -> void:
	var ids := selection.buildable()
	if ids == _palette_ids:
		_update_palette_state()
		return
	_palette_ids = ids

	for child in _palette.get_children():
		child.queue_free()

	var faction: String = world.players[selection.player_index].faction
	for id in ids:
		var def: Dictionary = IdUnitDefs.get_def(id, faction)
		var b := Button.new()
		b.custom_minimum_size = Vector2(102, 44)
		b.clip_text = true
		var key := IdUnitDefs.hotkey(id)
		b.text = "%s%s\n%d m  %d e" % [
			"[%s] " % key if key != "" else "",
			String(def.get("short", def.get("name", id))),
			int(def.get("metal", 0)), int(def.get("energy", 0)),
		]
		b.add_theme_font_size_override("font_size", 11)
		b.tooltip_text = "%s\n%s" % [
			String(def.get("name", id)), String(def.get("desc", "")),
		]
		b.pressed.connect(_on_build_pressed.bind(id))
		_palette.add_child(b)
	_update_palette_state()


## Grey out what the player cannot currently afford, and mark the structure
## they are holding.
func _update_palette_state() -> void:
	var p: IdPlayer = world.players[selection.player_index]
	var faction: String = p.faction
	for i in range(_palette.get_child_count()):
		if i >= _palette_ids.size():
			break
		var b: Button = _palette.get_child(i)
		var def: Dictionary = IdUnitDefs.get_def(_palette_ids[i], faction)
		var affordable: bool = p.metal >= float(def.get("metal", 0)) * 0.25
		b.modulate = Color.WHITE if affordable else Color(0.62, 0.62, 0.62)
		b.button_pressed = _palette_ids[i] == selection.build_def


func _on_build_pressed(def_id: String) -> void:
	var def: Dictionary = IdUnitDefs.get_def(
		def_id, world.players[selection.player_index].faction
	)
	if String(def.get("kind", "")) == "building":
		selection.build_def = def_id
	else:
		selection.queue_unit(def_id)


## Act on a build hotkey. The keys come from the shared data file, so a
## faction's equivalent structure sits on the same key slot for slot.
func press_hotkey(key: String) -> bool:
	for id in _palette_ids:
		if IdUnitDefs.hotkey(id) == key:
			_on_build_pressed(id)
			return true
	return false


# ---------------------------------------------------------------- overlay

func _draw_overlay() -> void:
	var cam: IdRtsCamera = selection.cam

	for e in world.entities:
		if not e.alive or not e.selected:
			continue
		var pos := Vector3(e.x, cam.terrain.height_at(e.x, e.y), e.y)
		if cam.is_position_behind(pos):
			continue
		var centre := cam.unproject_position(pos)
		# Scale the ring by projecting a point one radius to the side, so a
		# unit's marker tracks its size at any zoom.
		var edge := cam.unproject_position(pos + Vector3(e.radius, 0, 0))
		var r: float = maxf(6.0, centre.distance_to(edge))
		var colour: Color = OK if e.player == selection.player_index else STALL
		_overlay.draw_arc(centre, r, 0.0, TAU, 24, colour, 1.5, true)
		if e.max_hp > 0.0 and e.hp < e.max_hp:
			var w: float = r * 2.0
			var frac: float = e.health_fraction()
			var bar := Vector2(centre.x - r, centre.y - r - 6.0)
			_overlay.draw_rect(Rect2(bar, Vector2(w, 3)), Color(0, 0, 0, 0.6))
			_overlay.draw_rect(
				Rect2(bar, Vector2(w * frac, 3)),
				OK.lerp(STALL, 1.0 - frac)
			)

	if selection.dragging:
		var rect := Rect2(selection.drag_start, Vector2.ZERO).expand(selection.drag_end)
		_overlay.draw_rect(rect, Color(0.42, 0.86, 0.55, 0.12), true)
		_overlay.draw_rect(rect, OK, false, 1.0)

	_draw_build_preview(cam)


func _draw_build_preview(cam: IdRtsCamera) -> void:
	if selection.build_def == "":
		return
	var preview := selection.build_preview(_overlay.get_local_mouse_position())
	if preview.is_empty():
		return
	var half: float = float(preview["def"].get("footprintPx", 64)) * 0.5
	var cx: float = preview["x"]
	var cy: float = preview["y"]
	var colour: Color = OK if bool(preview["ok"]) else STALL

	var corners: Array[Vector2] = []
	for c in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
		var wx: float = cx + c.x * half
		var wy: float = cy + c.y * half
		var pos := Vector3(wx, cam.terrain.height_at(wx, wy), wy)
		if cam.is_position_behind(pos):
			return
		corners.append(cam.unproject_position(pos))
	for i in range(4):
		_overlay.draw_line(corners[i], corners[(i + 1) % 4], colour, 2.0)
