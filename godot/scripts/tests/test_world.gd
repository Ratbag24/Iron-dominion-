extends SceneTree

## Runs the ported simulation for a few simulated minutes and checks that a
## match actually develops: extractors come up, power gets built, factories
## produce, and the two sides find each other.

var failures: int = 0


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


func _init() -> void:
	var world := IdWorld.new({
		"seed": 12345,
		"players": [
			{"name": "Vanguard AI", "faction": "vanguard", "is_ai": true},
			{"name": "Legion AI", "faction": "legion", "is_ai": true},
		],
	})

	print("\nSetup")
	print("-----")
	check(world.entities.size() == 2, "both commanders spawned",
		"%d entities" % world.entities.size())
	check(world.players[0].commander_id != world.players[1].commander_id,
		"commanders are distinct")
	check(not world.map.metal_spots.is_empty(), "map has metal spots",
		"%d spots" % world.map.metal_spots.size())

	# --- run the match ----------------------------------------------------
	var target_ticks: int = IdWorld.SIM_HZ * 600  # ten simulated minutes
	var started := Time.get_ticks_usec()
	var ticks_run: int = 0
	for i in range(target_ticks):
		world.tick()
		ticks_run += 1
		if world.game_over:
			break
	var elapsed_ms := float(Time.get_ticks_usec() - started) / 1000.0
	var per_tick := elapsed_ms / float(maxi(ticks_run, 1))

	print("\nAfter %.0f simulated seconds" % world.time)
	print("-------------------------------")

	var built_any := false
	for i in range(2):
		var p: IdPlayer = world.players[i]
		var mine: Array[IdEntity] = world.units_of(i)
		var extractors: int = 0
		var power: int = 0
		var factories: int = 0
		var army: int = 0
		for e in mine:
			if e.under_construction:
				continue
			if not e.metal_spot.is_empty():
				extractors += 1
			if float(e.def.get("energyPerSecond", 0.0)) > 0.0 or bool(e.def.get("windPowered", false)):
				power += 1
			if bool(e.def.get("factory", false)):
				factories += 1
			if not e.weapons.is_empty() and float(e.def.get("speed", 0.0)) > 0.0:
				army += 1
		print("  %s: %d units, %d mex, %d power, %d factory, %d army, %.1f metal/s, %.0f energy/s"
			% [p.name, mine.size(), extractors, power, factories, army,
				p.metal_income, p.energy_income])
		check(extractors >= 4, "%s claimed metal spots" % p.name, "%d extractors" % extractors)
		check(power >= 2, "%s built power" % p.name, "%.0f energy/s" % p.energy_income)
		check(factories >= 1, "%s got a factory up" % p.name, "%d" % factories)
		check(p.stats["built"] > 20, "%s kept producing" % p.name,
			"%d built" % p.stats["built"])
		if mine.size() > 4:
			built_any = true

	print("\nSimulation")
	print("----------")
	check(built_any, "both sides developed past their commander")

	var moving: int = 0
	for e in world.entities:
		if e.speed > 1.0:
			moving += 1
	check(moving > 0, "units are actually moving", "%d under way" % moving)

	var total_kills: int = world.players[0].stats["killed"] + world.players[1].stats["killed"]
	check(world.time > 200.0 or world.game_over, "the match ran its course",
		"%.0fs, game_over=%s" % [world.time, world.game_over])
	check(total_kills > 0, "the two sides fought",
		"%d kills, %d wrecks" % [total_kills, world.wrecks.size()])

	# The tick has to fit in 33ms for the game to hold 30Hz with a frame to
	# spare; this is a headless upper bound with no rendering competing.
	check(per_tick < 8.0, "tick stays inside its budget",
		"%.2fms per tick over %d ticks" % [per_tick, ticks_run])

	var explored: int = 0
	for v in world.fog[0].explored:
		explored += v
	check(explored > 0, "fog of war is being revealed",
		"%d cells explored" % explored)

	world.dispose()

	print("")
	if failures == 0:
		print("PASS: a full match runs end to end")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
