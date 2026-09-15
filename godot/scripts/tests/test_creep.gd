extends SceneTree

## The infection of the ground, checked against the rules the browser build
## pins in tests/headless.test.mjs.

var failures: int = 0


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


func held(map: IdGameMap) -> int:
	var n := 0
	for v in map.corruption:
		if v >= IdCreep.CREEP_HELD:
			n += 1
	return n


func run(world: IdWorld, seconds: float) -> void:
	for i in int(seconds * IdWorld.SIM_HZ):
		world.tick()


func commander_of(world: IdWorld, player: int) -> IdEntity:
	for e in world.units_of(player):
		if bool(e.def.get("isCommander", false)):
			return e
	return null


func _init() -> void:
	print("\nSpread")
	print("------")
	var world := IdWorld.new({
		"seed": 12,
		"players": [
			{"name": "Hive", "faction": "blight"},
			{"name": "Humans", "faction": "concord"},
		],
	})
	var map: IdGameMap = world.map
	var hive := commander_of(world, 0)
	check(held(map) == 0, "the ground starts clean")
	# Measured while the front is still moving: from one source it reaches
	# its full extent in about forty seconds.
	run(world, 10)
	var early := held(map)
	check(IdCreep.creep_at(map, hive.x, hive.y) >= IdCreep.CREEP_HELD,
		"the hive infects the ground it stands on",
		"%.2f under the hive" % IdCreep.creep_at(map, hive.x, hive.y))
	run(world, 30)
	var later := held(map)
	check(later > int(float(early) * 1.3), "and it keeps spreading", "%d -> %d cells held" % [early, later])
	var human := commander_of(world, 1)
	check(IdCreep.creep_at(map, human.x, human.y) == 0.0, "the humans leave no stain")

	print("\nStanding on it")
	print("--------------")
	var husk: IdEntity = world.spawn("bl_husk", 0, hive.x + 40.0, hive.y, {"complete": true})
	var tank: IdEntity = world.spawn("con_tank", 1, hive.x - 40.0, hive.y, {"complete": true})
	husk.hp = husk.max_hp * 0.5
	var before := husk.hp
	run(world, 3)
	check(is_equal_approx(husk.speed_scale, IdCreep.CREEP_SPEED_OWN),
		"the hive moves faster on its own ground", "x%.2f" % husk.speed_scale)
	check(husk.hp > before, "and heals there", "%d -> %d" % [int(before), int(husk.hp)])
	check(is_equal_approx(tank.speed_scale, IdCreep.CREEP_SPEED_OTHER),
		"a tank is slowed wading through it", "x%.2f" % tank.speed_scale)
	var clean: IdEntity = world.spawn("con_tank", 1, 200.0, 200.0, {"complete": true})
	run(world, 1)
	check(is_equal_approx(clean.speed_scale, 1.0), "and unhindered on clean ground")

	print("\nWithout the hive")
	print("----------------")
	# A pit grown well away from the hive, then killed: its patch has to die
	# with it. (Killing the hive itself would end the match and stop the clock.)
	# Somewhere on land that nobody's guns can reach: the first attempt put it
	# within range of the human commander, who shot it before it took.
	var px := 0.0
	var py := 0.0
	var found := false
	for cy in range(4, map.rows - 4):
		for cx in range(4, map.cols - 4):
			var x := (float(cx) + 0.5) * float(map.cell)
			var y := (float(cy) + 0.5) * float(map.cell)
			if map.terrain[map.idx(cx, cy)] != IdGameMap.TERRAIN_LAND:
				continue
			# Well past the 900 units at which an idle builder wanders over to
			# assist a site: the hive did exactly that, and its own stain then
			# covered the patch the test was watching die.
			if IdMath.dist(x, y, hive.x, hive.y) < 1200.0 or IdMath.dist(x, y, human.x, human.y) < 700.0:
				continue
			px = x
			py = y
			found = true
			break
		if found:
			break
	check(found, "found open ground for a pit")
	var pit: IdEntity = world.spawn("bl_pit", 0, px, py, {"complete": true})
	run(world, 30)
	var around := func() -> int:
		var n := 0
		var c := float(map.cell)
		for cy in range(int(py / c) - 12, int(py / c) + 13):
			for cx in range(int(px / c) - 12, int(px / c) + 13):
				if map.in_bounds(cx, cy) and map.corruption[map.idx(cx, cy)] >= IdCreep.CREEP_HELD:
					n += 1
		return n
	var peak: int = around.call()
	check(peak > 40, "a pit stains the ground around it", "%d cells" % peak)
	world.kill(pit, null)
	run(world, 60)
	check(around.call() < int(float(peak) * 0.25), "and the stain dies back once the pit is gone",
		"%d -> %d cells" % [peak, around.call()])
	print("\nGrowing on it")
	print("-------------")
	# The hive builds on its own ground only; the tap is the exception.
	var w3 := IdWorld.new({
		"seed": 13,
		"players": [
			{"name": "Hive", "faction": "blight"},
			{"name": "Humans", "faction": "concord"},
		],
	})
	var m3: IdGameMap = w3.map
	var h3 := commander_of(w3, 0)
	run(w3, 20)
	var pit_def: Dictionary = IdUnitDefs.get_def("bl_pit", "blight")
	var tap_def: Dictionary = IdUnitDefs.get_def("bl_tap", "blight")
	check(bool(pit_def.get("needsCreep", false)) and not bool(tap_def.get("needsCreep", false)),
		"a pit needs creep and a tap does not")
	var fp: int = int(pit_def["footprint"])
	var near: Dictionary = m3.snap_footprint(h3.x + 90.0, h3.y, fp)
	var near_ok: bool = m3.can_place(near["cx"], near["cy"], fp)
	check(not near_ok or IdOrders.can_build_here(w3, 0, pit_def, near["cx"], near["cy"]),
		"a pit can be grown beside the hive", "on the stain" if near_ok else "no room beside the hive to test")
	var fx := -1
	var fy := -1
	for cy in range(4, m3.rows - 4):
		for cx in range(4, m3.cols - 4):
			var x := (float(cx) + 0.5) * float(m3.cell)
			var y := (float(cy) + 0.5) * float(m3.cell)
			if IdMath.dist(x, y, h3.x, h3.y) < 1200.0:
				continue
			var s: Dictionary = m3.snap_footprint(x, y, fp)
			if not m3.can_place(s["cx"], s["cy"], fp):
				continue
			fx = s["cx"]
			fy = s["cy"]
			break
		if fx >= 0:
			break
	check(fx >= 0 and not IdOrders.can_build_here(w3, 0, pit_def, fx, fy),
		"and not on clean ground far from it")
	w3.dispose()

	var wet := 0
	for i in map.corruption.size():
		if map.terrain[i] == IdGameMap.TERRAIN_WATER and map.corruption[i] > 0.0:
			wet += 1
	check(wet == 0, "water is never infected")
	world.dispose()

	print("")
	if failures == 0:
		print("PASS: the hive's ground spreads, helps its own, and dies with it")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
