extends SceneTree

func _init() -> void:
	var map := IdGameMap.new(42)
	var tb := IdTerrainBuilder.new(map, 2)
	print("map: %dx%d cells, water_line %.3f" % [map.cols, map.rows, map.water_line])
	print("height at start: %.2f" % tb.height_at(map.start_positions[0]["x"], map.start_positions[0]["y"]))
	print("water level: %.2f" % tb.water_level())

	var mesh := tb.build_mesh()
	if mesh == null:
		print("FAIL: build_mesh returned null")
		quit(1)
		return
	print("surfaces: %d" % mesh.get_surface_count())
	if mesh.get_surface_count() == 0:
		print("FAIL: mesh has no surfaces")
		quit(1)
		return
	var arrays := mesh.surface_get_arrays(0)
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var norms = arrays[Mesh.ARRAY_NORMAL]
	var cols = arrays[Mesh.ARRAY_COLOR]
	var idx = arrays[Mesh.ARRAY_INDEX]
	print("vertices: %d" % verts.size())
	print("normals:  %s" % ("none" if norms == null else str(norms.size())))
	print("colours:  %s" % ("none" if cols == null else str(cols.size())))
	print("indices:  %s" % ("none" if idx == null else str(idx.size())))
	print("aabb: %s" % str(mesh.get_aabb()))
	if verts.size() > 0:
		print("first vertex: %s   mid vertex: %s" % [str(verts[0]), str(verts[verts.size() / 2])])
	if cols != null and cols.size() > 0:
		print("first colour: %s" % str(cols[0]))
	quit(0)
