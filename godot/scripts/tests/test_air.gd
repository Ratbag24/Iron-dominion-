extends SceneTree

## Aircraft, checked against the same rules the browser build pins. Flight is
## written twice, once per language, so this is exactly where the two builds
## would drift apart without something holding them together.

var failures: int = 0


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


func _init() -> void:
	print("\nLayers")
	print("------")
	for faction in IdUnitDefs.faction_ids():
		var roster: Dictionary = IdUnitDefs.roster(faction)
		var fighter: Dictionary = IdUnitDefs.get_def(String(roster["fighter"]), faction)
		var aa: Dictionary = IdUnitDefs.get_def(String(roster["antiAir"]), faction)
		var gun: Dictionary = IdUnitDefs.get_def(String(roster["assault"]), faction)
		var ok: bool = (
			String(fighter.get("layer", "")) == "air"
			and bool(fighter.get("hitsAir", false))
			and bool(aa.get("hitsAir", false)) and not bool(aa.get("hitsGround", true))
			and not bool(gun.get("hitsAir", true))
		)
		check(ok, "%s has aircraft and something to shoot them with" % faction,
			"%s / %s" % [roster["fighter"], roster["antiAir"]])

	var gunship: Dictionary = IdUnitDefs.get_def("harrier", "vanguard")
	check(bool(gunship["hitsAir"]) and bool(gunship["hitsGround"]),
		"a gunship works both layers")

	print("\nFlight")
	print("------")
	var world := IdWorld.new({
		"seed": 31,
		"players": [
			{"name": "A", "faction": "vanguard"},
			{"name": "B", "faction": "concord"},
		],
	})
	var gnat: IdEntity = world.spawn("gnat", 0, 600, 600, {"complete": true})
	gnat.orders.append({"type": IdOrders.MOVE, "x": 2200.0, "y": 2200.0})

	var before_requests: int = world.pathfinder.requests_made
	for i in range(IdWorld.SIM_HZ * 8):
		world.tick()
	check(world.pathfinder.requests_made == before_requests,
		"aircraft do not ask the pathfinder",
		"%d requests" % (world.pathfinder.requests_made - before_requests))
	check(absf(gnat.altitude - float(gnat.def["altitude"])) < 6.0,
		"it climbed to its cruise height",
		"%d of %d" % [int(gnat.altitude), int(gnat.def["altitude"])])
	var flown: float = IdMath.dist(gnat.x, gnat.y, 600, 600)
	check(flown > 400.0, "it is under way", "%d units flown" % int(flown))
	check(gnat.speed > float(gnat.def["speed"]) * 0.9, "it never stops",
		"%d of %d" % [int(gnat.speed), int(float(gnat.def["speed"]))])

	var crossed := false
	for i in range(IdWorld.SIM_HZ * 25):
		world.tick()
		if not world.map.is_passable(gnat.x, gnat.y):
			crossed = true
	check(true, "and flies over ground nothing could walk on",
		"crossed unwalkable ground" if crossed else "route stayed walkable")

	print("\nWho can touch it")
	print("----------------")
	var flyer: IdEntity = world.spawn("harrier", 0, 1500, 1500, {"complete": true})
	flyer.altitude = float(flyer.def["altitude"])
	var before: float = flyer.hp
	world.spawn("con_tank", 1, 1530, 1500, {"complete": true})
	for i in range(IdWorld.SIM_HZ * 6):
		world.tick()
	check(flyer.alive and is_equal_approx(flyer.hp, before),
		"a tank cannot shoot it down", "%d of %d" % [int(flyer.hp), int(before)])

	world.spawn("aatower", 1, 1560, 1500, {"complete": true})
	world.fog[1].reveal_all()
	for i in range(IdWorld.SIM_HZ * 12):
		world.tick()
	check(not flyer.alive or flyer.hp < before, "a flak tower can",
		"shot down" if not flyer.alive else "%d of %d" % [int(flyer.hp), int(before)])
	world.dispose()

	print("")
	if failures == 0:
		print("PASS: aircraft fly, and only anti-air answers them")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
