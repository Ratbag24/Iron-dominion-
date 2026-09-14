extends SceneTree

## The Blight's conversion rule, checked against the same cases the browser
## build pins. Both simulations have to agree: the stats live in shared data,
## but this behaviour is written twice, once per language, and that is exactly
## where two builds drift apart.

var failures: int = 0


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


func _init() -> void:
	print("\nThe faction")
	print("-----------")
	var ids: Array = IdUnitDefs.faction_ids()
	check(ids.has("blight"), "the hive is a faction", ", ".join(PackedStringArray(ids)))

	var roster: Dictionary = IdUnitDefs.roster("blight")
	var missing: Array[String] = []
	for slot in roster:
		var id = roster[slot]
		if id != null and IdUnitDefs.base_def(String(id)).is_empty():
			missing.append(String(slot))
	check(missing.is_empty(), "every roster slot names a real definition",
		"missing: %s" % str(missing) if not missing.is_empty() else "21 slots")

	var husk_def: Dictionary = IdUnitDefs.get_def("bl_husk", "blight")
	var infects: float = float(husk_def["weapons"][0].get("infects", 0.0))
	check(infects > 0.0, "a hive weapon carries an infection chance", "%.2f" % infects)

	var taken_def: Dictionary = IdUnitDefs.get_def("con_tank", "blight")
	check(float(taken_def["weapons"][0].get("infects", 0.0)) == 0.0,
		"a captured unit does not inherit the teeth",
		"a taken tank still shoots what a tank shoots")

	print("\nTaking a unit")
	print("-------------")
	var world := IdWorld.new({
		"seed": 909,
		"players": [
			{"name": "Hive", "faction": "blight"},
			{"name": "Foe", "faction": "concord"},
		],
	})
	var hive: IdEntity = world.get_entity(world.players[0].commander_id)
	var husk: IdEntity = world.spawn("bl_husk", 0, 900, 900, {"complete": true})
	var tank: IdEntity = world.spawn("con_tank", 1, 920, 900, {"complete": true})

	# A killing blow that always converts, so the rule is tested and not the dice.
	world.kill(tank, husk, 1.0)
	var taken: Array[IdEntity] = world.units_of(0, "con_tank")
	check(taken.size() == 1, "a killed unit changes hands")
	if taken.size() == 1:
		check(taken[0].hp < taken[0].max_hp * 0.5, "it comes over wounded",
			"%d of %d" % [int(taken[0].hp), int(taken[0].max_hp)])
	check(world.wrecks.is_empty(), "it leaves no wreck behind")
	check(int(world.players[0].stats["converted"]) == 1,
		"it counts as converted, not as built")

	print("\nWhat is never taken")
	print("-------------------")
	var before: int = world.units_of(0).size()
	world.kill(world.get_entity(world.players[1].commander_id), husk, 1.0)
	check(world.units_of(0).size() == before, "a commander is never taken",
		"or one lucky bite would decide the match")

	var pillbox: IdEntity = world.spawn("con_pillbox", 1, 1200, 900, {"complete": true})
	world.kill(pillbox, husk, 1.0)
	check(world.units_of(0, "con_pillbox").is_empty(), "a building is never taken")

	var friend: IdEntity = world.spawn("bl_skitter", 0, 940, 900, {"complete": true})
	var friendly_before: int = world.units_of(0).size()
	world.kill(friend, hive, 1.0)
	check(world.units_of(0).size() == friendly_before - 1,
		"your own dead are not taken")
	world.dispose()

	# And a faction without teeth converts nothing at all.
	var plain := IdWorld.new({
		"seed": 909,
		"players": [
			{"name": "A", "faction": "vanguard"},
			{"name": "B", "faction": "concord"},
		],
	})
	var bot: IdEntity = plain.spawn("rifle", 0, 900, 900, {"complete": true})
	var victim: IdEntity = plain.spawn("con_tank", 1, 920, 900, {"complete": true})
	plain.kill(victim, bot, float(bot.def["weapons"][0].get("infects", 0.0)))
	check(plain.units_of(0, "con_tank").is_empty() and plain.wrecks.size() == 1,
		"a faction without teeth converts nothing", "and leaves a wreck as usual")
	plain.dispose()

	print("\nA match")
	print("-------")
	var live := IdWorld.new({
		"seed": 4242,
		"players": [
			{"name": "Hive", "faction": "blight", "is_ai": true},
			{"name": "Foe", "faction": "concord", "is_ai": true},
		],
	})
	for i in range(IdWorld.SIM_HZ * 420):
		live.tick()
		if live.game_over:
			break
	var army := 0
	for e in live.units_of(0):
		if not e.weapons.is_empty() and float(e.def.get("speed", 0.0)) > 0.0:
			army += 1
	check(live.units_of(0).size() > 6, "the hive runs an economy",
		"%d units, %.1f metal/s" % [live.units_of(0).size(), live.players[0].metal_income])
	check(army > 0, "and fields a brood", "%d fighting" % army)
	print("  info: %.0fs, kills %d/%d, converted %d"
		% [live.time, live.players[0].stats["killed"], live.players[1].stats["killed"],
			live.players[0].stats["converted"]])
	live.dispose()

	print("")
	if failures == 0:
		print("PASS: the hive plays, and takes what it kills")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
