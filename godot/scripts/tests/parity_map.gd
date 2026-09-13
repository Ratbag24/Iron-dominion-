extends SceneTree

## Checks the ported map generator against values dumped from the reference
## JavaScript build. Terrain, thresholds, start positions and metal spots must
## all agree, or the same seed would give two different games.

var _failures := 0

func _check(name: String, ok: bool, detail: String = "") -> void:
	if ok:
		print("  PASS  %s%s" % [name, ("  (%s)" % detail) if detail != "" else ""])
	else:
		print("  FAIL  %s%s" % [name, ("  (%s)" % detail) if detail != "" else ""])
		_failures += 1

func _init() -> void:
	var f := FileAccess.open("res://data/parity-fixture.json", FileAccess.READ)
	var fx: Dictionary = JSON.parse_string(f.get_as_text())
	var maps: Dictionary = fx["maps"]

	for seed_key in maps.keys():
		var want: Dictionary = maps[seed_key]
		var t0 := Time.get_ticks_msec()
		var m := IdGameMap.new(int(seed_key))
		var ms := Time.get_ticks_msec() - t0
		print("seed %s  (generated in %dms)" % [seed_key, ms])

		_check("grid size", m.cols == int(want["cols"]) and m.rows == int(want["rows"]),
			"%dx%d" % [m.cols, m.rows])

		var counts := [0, 0, 0]
		for t in m.terrain:
			counts[t] += 1
		var want_counts: Array = want["terrainCounts"]
		_check("terrain classification",
			counts[0] == int(want_counts[0]) and counts[1] == int(want_counts[1]) and counts[2] == int(want_counts[2]),
			"land %d water %d rock %d" % [counts[0], counts[1], counts[2]])

		_check("water line", absf(m.water_line - float(want["waterLine"])) < 1e-6,
			"%.8f vs %.8f" % [m.water_line, float(want["waterLine"])])
		_check("rock line", absf(m.rock_line - float(want["rockLine"])) < 1e-6,
			"%.8f vs %.8f" % [m.rock_line, float(want["rockLine"])])

		var want_starts: Array = want["startPositions"]
		var starts_ok := true
		for i in want_starts.size():
			var got: Dictionary = m.start_positions[i]
			if int(got["cx"]) != int(want_starts[i][0]) or int(got["cy"]) != int(want_starts[i][1]):
				starts_ok = false
		_check("start positions", starts_ok,
			"[%d,%d] [%d,%d]" % [m.start_positions[0]["cx"], m.start_positions[0]["cy"],
				m.start_positions[1]["cx"], m.start_positions[1]["cy"]])

		_check("metal spot count", m.metal_spots.size() == int(want["metalSpotCount"]),
			"%d spots" % m.metal_spots.size())

		var want_spots: Array = want["firstSpots"]
		var spots_ok := true
		for i in want_spots.size():
			if i >= m.metal_spots.size():
				spots_ok = false
				break
			var s: Dictionary = m.metal_spots[i]
			if int(s["cx"]) != int(want_spots[i][0]) or int(s["cy"]) != int(want_spots[i][1]) \
				or absf(float(s["yield"]) - float(want_spots[i][2])) > 1e-6:
				spots_ok = false
		_check("metal spot placement order", spots_ok, "%d sampled" % want_spots.size())

		var want_heights: Array = want["heightSamples"]
		var indices := [0, 1000, 5000, 20000, 36000]
		var heights_ok := true
		var worst := 0.0
		for i in indices.size():
			var d: float = absf(m.heights[indices[i]] - float(want_heights[i]))
			worst = maxf(worst, d)
			if d > 1e-6:
				heights_ok = false
		_check("height field", heights_ok, "max deviation %.9f" % worst)

	print("")
	if _failures == 0:
		print("PASS: the ported map generator matches the reference build exactly")
		quit(0)
	else:
		print("%d failures" % _failures)
		quit(1)
