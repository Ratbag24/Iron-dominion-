extends SceneTree

## The four-player map: quarters rather than a mirrored duel.
##
## Fairness is the whole point of generating symmetrically, so this measures it
## rather than trusting it: the same ground under every start, the same metal
## within reach of each, and a way between all of them.

var failures: int = 0


func check(ok: bool, label: String, detail: String = "") -> void:
	var suffix: String = "  (%s)" % detail if detail != "" else ""
	if ok:
		print("  PASS  %s%s" % [label, suffix])
	else:
		print("  FAIL  %s%s" % [label, suffix])
		failures += 1


func _init() -> void:
	print("\nLayout")
	print("------")
	var map := IdGameMap.new(20260914, 3072, 3072, 4)
	check(map.four_fold(), "the map is laid out in quarters")
	check(map.start_positions.size() == 4, "four starts",
		"%d" % map.start_positions.size())

	# Each start should sit a quarter turn from the last.
	var ok_rotation := true
	for i in range(4):
		var a: Dictionary = map.start_positions[i]
		var b: Dictionary = map.start_positions[(i + 1) % 4]
		var turned := map.rotate90(int(a["cx"]), int(a["cy"]))
		if turned != Vector2i(int(b["cx"]), int(b["cy"])):
			ok_rotation = false
	check(ok_rotation, "each start is a quarter turn from the next")

	print("\nFair ground")
	print("-----------")
	# The height field must be invariant under a quarter turn, or one player
	# starts on a hill and another in a bowl.
	var worst := 0.0
	for cy in range(0, map.rows, 3):
		for cx in range(0, map.cols, 3):
			var p := map.rotate90(cx, cy)
			worst = maxf(worst, absf(
				map.heights[map.idx(cx, cy)] - map.heights[map.idx(p.x, p.y)]
			))
	check(worst < 1e-5, "the ground is the same in every quarter",
		"worst difference %.9f" % worst)

	print("\nFair resources")
	print("--------------")
	check(map.metal_spots.size() % 4 == 0, "spots come in complete sets of four",
		"%d spots" % map.metal_spots.size())
	check(map.metal_spots.size() >= 32, "there are enough of them",
		"%d" % map.metal_spots.size())

	# Count the spots nearest each start; the four counts should match.
	var near: Array[int] = [0, 0, 0, 0]
	for s in map.metal_spots:
		var best := 0
		var best_d := INF
		for i in range(4):
			var st: Dictionary = map.start_positions[i]
			var d: float = IdMath.dist2(s["x"], s["y"], st["x"], st["y"])
			if d < best_d:
				best_d = d
				best = i
		near[best] += 1
	var lo: int = near.min()
	var hi: int = near.max()
	check(hi - lo <= 1, "every start has the same metal within reach",
		"%s" % str(near))

	# Four-fold averaging makes the centre of the map a fixed point of every
	# rotation, so it smooths into a dome or a bowl. Measured against the duel
	# layout that costs nothing: both come out around 72% land, and how much
	# rock lands in the middle varies by seed in both. This guards against a
	# layout that quietly eats the playable area anyway.
	var land := 0
	for t in map.terrain:
		if t == IdGameMap.TERRAIN_LAND:
			land += 1
	var land_fraction := float(land) / float(map.terrain.size())
	check(land_fraction > 0.6, "most of the map is still walkable",
		"%.0f%% land" % (land_fraction * 100.0))

	print("\nConnected")
	print("---------")
	var pf := IdPathfinder.new(map)
	var routes := 0
	for i in range(4):
		for j in range(i + 1, 4):
			var a: Dictionary = map.start_positions[i]
			var b: Dictionary = map.start_positions[j]
			if not pf.find_path(a["x"], a["y"], b["x"], b["y"]).is_empty():
				routes += 1
	check(routes == 6, "every start can reach every other", "%d of 6 routes" % routes)

	print("\nA four-way match")
	print("----------------")
	var world := IdWorld.new({
		"seed": 20260914,
		"players": [
			{"name": "A", "faction": "vanguard", "is_ai": true},
			{"name": "B", "faction": "legion", "is_ai": true},
			{"name": "C", "faction": "concord", "is_ai": true},
			{"name": "D", "faction": "vanguard", "is_ai": true},
		],
	})
	check(world.map.start_positions.size() == 4,
		"the world built a four-start map")
	check(world.entities.size() == 4, "four commanders spawned",
		"%d" % world.entities.size())

	var seen: Dictionary = {}
	for e in world.entities:
		seen[Vector2(e.x, e.y)] = true
	check(seen.size() == 4, "no two commanders share a spot")

	for i in range(IdWorld.SIM_HZ * 240):
		world.tick()
		if world.game_over:
			break

	var developed := 0
	for i in range(4):
		if world.units_of(i).size() > 4:
			developed += 1
	check(developed >= 3, "the sides develop independently",
		"%d of 4 built past their commander" % developed)
	print("  info: %.0fs simulated, %d entities, game_over=%s"
		% [world.time, world.entities.size(), world.game_over])

	world.dispose()

	print("\nTwo against two")
	print("---------------")
	IdMatchSettings.opponents = 3
	IdMatchSettings.team_mode = "2v2"
	var specs: Array = IdMatchSettings.player_specs(true)
	check(specs.size() == 4, "four sides", "%d" % specs.size())
	var teams: Array = []
	for spec in specs:
		teams.append(int(spec["team"]))
	check(teams == [0, 0, 1, 1], "paired as neighbours round the map", str(teams))

	var allied := IdWorld.new({"seed": 31337, "players": specs})
	check(allied.players[0].team == allied.players[1].team,
		"the first two are allies")
	check(allied.players[0].team != allied.players[2].team,
		"and the other two are not")

	# Allies must not shoot each other, and must share what they can see.
	var a: IdEntity = allied.get_entity(allied.players[0].commander_id)
	var ally: IdEntity = allied.get_entity(allied.players[1].commander_id)
	var foe: IdEntity = allied.get_entity(allied.players[2].commander_id)
	check(not allied.is_enemy(a, ally), "allies are not enemies")
	check(allied.is_enemy(a, foe), "the other team is")

	for i in range(8):
		allied.tick()
	check(allied.fog[0].is_visible_at(ally.x, ally.y),
		"an ally's ground is revealed to us")
	check(not allied.fog[0].is_visible_at(foe.x, foe.y),
		"an enemy's is not")

	# A team survives while either of its commanders does.
	allied.kill(a, null)
	allied._cleanup()
	allied._check_victory()
	check(not allied.game_over, "losing one commander does not lose the match",
		"winner %d" % allied.winner)
	allied.kill(ally, null)
	allied._cleanup()
	allied._check_victory()
	check(allied.game_over and allied.winner == 1,
		"losing both hands the match to the other team",
		"over=%s winner=%d" % [allied.game_over, allied.winner])
	allied.dispose()

	# Leave the settings as they were found.
	IdMatchSettings.opponents = 1
	IdMatchSettings.team_mode = "ffa"

	print("")
	if failures == 0:
		print("PASS: four-player maps are fair, and teams hold together")
	else:
		print("FAIL: %d checks failed" % failures)
	quit(1 if failures > 0 else 0)
