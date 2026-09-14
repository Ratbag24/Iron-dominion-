extends SceneTree

## Where the seconds go when a match starts.

func _init() -> void:
	var t0 := Time.get_ticks_usec()
	var map := IdGameMap.new(12345)
	var t1 := Time.get_ticks_usec()
	var pf := IdPathfinder.new(map)
	var t2 := Time.get_ticks_usec()
	var terrain := IdTerrainBuilder.new(map, 2)
	var t3 := Time.get_ticks_usec()
	var mesh := terrain.build_mesh()
	var t4 := Time.get_ticks_usec()
	var normals := IdTerrainBuilder.detail_normal_image()
	var t5 := Time.get_ticks_usec()
	var mini := terrain.minimap_image(192)
	var t6 := Time.get_ticks_usec()

	var ms := func(a, b) -> float: return float(b - a) / 1000.0
	print("map generation      %7.1f ms" % ms.call(t0, t1))
	print("pathfinder grid     %7.1f ms" % ms.call(t1, t2))
	print("render heightfield  %7.1f ms" % ms.call(t2, t3))
	print("ground mesh         %7.1f ms  (%d triangles)"
		% [ms.call(t3, t4), mesh.get_faces().size() / 3])
	print("detail normal map   %7.1f ms  (%d px)"
		% [ms.call(t4, t5), normals.get_width()])
	print("minimap image       %7.1f ms" % ms.call(t5, t6))
	print("total               %7.1f ms" % ms.call(t0, t6))
	quit()
