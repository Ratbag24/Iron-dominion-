extends SceneTree

## Infantry, checked against the same rules the browser build pins.
##
## Three things have to be true at once for infantry to be worth building
## rather than being small tanks: the armour table, the squad, and the footing.
## All three are written twice, once per language, so this is exactly where the
## two builds would drift apart without something holding them together.

var failures: int = 0


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


## Mirrors the multiplier lookup in projectiles.gd, which is private.
func scale_of(weapon: Dictionary, armour: String) -> float:
	var vs: Dictionary = weapon.get("vs", {})
	if vs.is_empty() or armour == IdUnitDefs.ARMOUR_STANDARD:
		return 1.0
	return float(vs.get(armour, 1.0))


func _init() -> void:
	print("\nEvery faction musters")
	print("---------------------")
	for faction in IdUnitDefs.faction_ids():
		var roster: Dictionary = IdUnitDefs.roster(faction)
		var troop: Dictionary = IdUnitDefs.get_def(String(roster["trooper"]), faction)
		var hall: Dictionary = IdUnitDefs.get_def(String(roster["barracks"]), faction)
		var ok: bool = (
			bool(troop.get("isInfantry", false))
			and int(troop.get("squad", 1)) > 1
			and bool(hall.get("factory", false))
			and (hall.get("build", []) as Array).has(String(roster["trooper"]))
		)
		check(ok, "%s musters infantry" % faction,
			"%s -> %s x%d" % [roster["barracks"], roster["trooper"], int(troop.get("squad", 1))])

	print("\nArmour")
	print("------")
	var troop: Dictionary = IdUnitDefs.get_def("trooper", "vanguard")
	var tank: Dictionary = IdUnitDefs.get_def("con_tank", "concord")
	var cannon: Dictionary = (tank["weapons"] as Array)[0]
	var rifle: Dictionary = (troop["weapons"] as Array)[0]
	var soft_armour := String(troop.get("armour", ""))
	var hard_armour := String(tank.get("armour", ""))
	check(scale_of(cannon, soft_armour) < 0.6, "a tank gun is wasted on troops",
		"x%.2f" % scale_of(cannon, soft_armour))
	check(is_equal_approx(scale_of(cannon, hard_armour), 1.0),
		"and loses nothing against armour")
	check(scale_of(rifle, soft_armour) > 1.4 and is_equal_approx(scale_of(rifle, hard_armour), 1.0),
		"a rifle is the other way round",
		"x%.2f / x%.2f" % [scale_of(rifle, soft_armour), scale_of(rifle, hard_armour)])

	print("\nSquads")
	print("------")
	var world := IdWorld.new({
		"seed": 45,
		"players": [
			{"name": "A", "faction": "vanguard"},
			{"name": "B", "faction": "concord"},
		],
	})
	var hall: IdEntity = world.spawn("barracks", 0, 800, 800, {"complete": true})
	world.players[0].metal = 9000.0
	world.players[0].energy = 9000.0
	hall.factory_queue.append({"defId": "trooper", "count": 1, "origCount": 1})
	var want: int = int(IdUnitDefs.get_def("trooper", "vanguard").get("squad", 1))
	var made := 0
	for i in range(IdWorld.SIM_HZ * 150):
		world.tick()
		made = world.units_of(0, "trooper").size()
		if made >= want:
			break
	var squad: Array[IdEntity] = world.units_of(0, "trooper")
	check(squad.size() == want, "one order produces a whole squad",
		"%d of %d" % [squad.size(), want])
	check(hall.factory_queue.is_empty(), "and the queue only charged for one")
	var spread := 0.0
	if not squad.is_empty():
		for u in squad:
			spread = maxf(spread, IdMath.dist(u.x, u.y, squad[0].x, squad[0].y))
	check(spread > 8.0, "they come out spread, not stacked", "%d apart" % int(spread))
	world.dispose()

	print("\nFooting")
	print("-------")
	var map := IdGameMap.new(9)
	var rock := Vector2i(-1, -1)
	var water := Vector2i(-1, -1)
	for cy in range(4, map.rows - 4):
		for cx in range(4, map.cols - 4):
			var terr: int = map.terrain[map.idx(cx, cy)]
			if rock.x < 0 and terr == IdGameMap.TERRAIN_ROCK:
				rock = Vector2i(cx, cy)
			if water.x < 0 and terr == IdGameMap.TERRAIN_WATER:
				water = Vector2i(cx, cy)
		if rock.x >= 0 and water.x >= 0:
			break
	check(rock.x >= 0, "the map has rock to test against")
	if rock.x >= 0:
		check(not map.is_passable_cell_for(rock.x, rock.y, false),
			"a vehicle cannot stand on rock")
		check(map.is_passable_cell_for(rock.x, rock.y, true), "a squad can")
	if water.x >= 0:
		check(not map.is_passable_cell_for(water.x, water.y, true),
			"and neither of them can walk on water")

	# The pathfinder has to agree with the map, or a squad would route onto a
	# ridge and be shoved straight back off it.
	# Built rather than found: clear a band of land right across the map, then
	# lay a rock ridge through the middle of it. Looking for a natural ridge
	# with standable ground on both sides makes the test depend on the terrain
	# generator, and it would go quiet the day the generator changed.
	var walled := IdGameMap.new(9)
	var ridge_y: int = walled.rows / 2
	for cx in walled.cols:
		for cy in range(ridge_y - 6, ridge_y + 7):
			walled.terrain[walled.idx(cx, cy)] = IdGameMap.TERRAIN_LAND
		walled.terrain[walled.idx(cx, ridge_y)] = IdGameMap.TERRAIN_ROCK
		walled.terrain[walled.idx(cx, ridge_y + 1)] = IdGameMap.TERRAIN_ROCK
	var pf := IdPathfinder.new(walled)
	var cell := float(walled.cell)
	var sx: float = (float(walled.cols / 2) + 0.5) * cell
	var sy: float = (float(ridge_y - 4) + 0.5) * cell
	var ty: float = (float(ridge_y + 5) + 0.5) * cell
	check(walled.is_passable(sx, sy) and walled.is_passable(sx, ty),
		"both sides of the ridge are standable ground",
		"%d,%d -> %d,%d" % [int(sx), int(sy), int(sx), int(ty)])
	var foot_path: Array = pf.find_path(sx, sy, sx, ty, true)
	var wheel_path: Array = pf.find_path(sx, sy, sx, ty, false)
	check(not foot_path.is_empty(), "infantry find a way over the ridge",
		"%d waypoints" % foot_path.size())
	# The ridge spans the map, so there is no way round it at all: a vehicle
	# asked to cross has nowhere to go.
	check(wheel_path.is_empty(), "and a vehicle has no route at all",
		"foot %d waypoints, wheels %d" % [foot_path.size(), wheel_path.size()])

	print("")
	if failures == 0:
		print("PASS: infantry are troops, not small tanks")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
