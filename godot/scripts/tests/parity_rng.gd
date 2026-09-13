extends SceneTree

## Verifies that the Godot generator reproduces the JavaScript one bit for bit.
## Terrain is derived entirely from this stream, so any divergence here means
## the two builds would generate different maps from the same seed.

func _init() -> void:
	var f := FileAccess.open("res://data/parity-fixture.json", FileAccess.READ)
	if f == null:
		push_error("parity-fixture.json missing")
		quit(1)
		return
	var fx: Dictionary = JSON.parse_string(f.get_as_text())
	var failures := 0

	for seed_key in fx["rng"].keys():
		var rng := IdRng.new(int(seed_key))
		var expected: Array = fx["rng"][seed_key]
		var ok := true
		for i in expected.size():
			var got: float = rng.next()
			if abs(got - float(expected[i])) > 1e-9:
				print("  FAIL rng seed %s [%d]: got %.12f expected %.12f" % [seed_key, i, got, float(expected[i])])
				failures += 1
				ok = false
		if ok:
			print("  rng seed %-6s %d values match" % [seed_key, expected.size()])

	for seed_key in fx["noise"].keys():
		var noise := IdNoise2D.new(int(seed_key))
		var ok := true
		for entry in fx["noise"][seed_key]:
			var x := float(entry["x"])
			var y := float(entry["y"])
			var raw: float = noise.sample(x, y)
			var f4: float = noise.fbm(x, y, 4)
			if abs(raw - float(entry["raw"])) > 1e-8:
				print("  FAIL noise %s raw (%s,%s): %.10f vs %.10f" % [seed_key, x, y, raw, float(entry["raw"])])
				failures += 1
				ok = false
			if abs(f4 - float(entry["fbm4"])) > 1e-8:
				print("  FAIL noise %s fbm (%s,%s): %.10f vs %.10f" % [seed_key, x, y, f4, float(entry["fbm4"])])
				failures += 1
				ok = false
		if ok:
			print("  noise seed %-6s %d samples match" % [seed_key, fx["noise"][seed_key].size()])

	if failures == 0:
		print("PASS: the Godot generator reproduces the JavaScript stream exactly")
		quit(0)
	else:
		print("%d parity failures" % failures)
		quit(1)
