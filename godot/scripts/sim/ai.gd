class_name IdAI
extends RefCounted

## Skirmish AI.
##
## It plays the same game you do: claim metal spots, keep energy ahead of
## demand, get a factory up, keep builders busy, and push with waves that grow
## as the match goes on. It has no extra vision and pays the same costs; the
## only handicap is an income multiplier chosen by the difficulty setting.

const LEVELS: Dictionary = {
	"easy": {
		"think": 0.75, "income": 0.85, "builders": 2, "wave_base": 6.0,
		"wave_growth": 1.0 / 120.0, "max_wave": 24, "tech_time": 660.0,
		"defence_time": 300.0, "air_time": 600.0, "barracks_time": 150.0,
	},
	"normal": {
		"think": 0.5, "income": 1.0, "builders": 4, "wave_base": 8.0,
		"wave_growth": 1.0 / 90.0, "max_wave": 34, "tech_time": 480.0,
		"defence_time": 220.0, "air_time": 420.0, "barracks_time": 105.0,
	},
	"hard": {
		"think": 0.35, "income": 1.2, "builders": 6, "wave_base": 10.0,
		"wave_growth": 1.0 / 70.0, "max_wave": 48, "tech_time": 380.0,
		"defence_time": 160.0, "air_time": 320.0, "barracks_time": 75.0,
	},
}

var world: IdWorld
var player: IdPlayer
var cfg: Dictionary

## Everything below is written against roster slots, never definition ids, so
## the same build order drives any faction.
var R: Dictionary

var base_x: float = 0.0
var base_y: float = 0.0
var enemy_x: float = 0.0
var enemy_y: float = 0.0
var stage_x: float = 0.0
var stage_y: float = 0.0

var timer: float = 0.0
var attacking: bool = false
var attack_target: Vector2 = Vector2.ZERO
var retarget_at: float = 0.0
var defend_until: float = 0.0
## A decaying count of enemy aircraft we can currently see. Decaying rather
## than instantaneous so one fly-past keeps the anti-air rule on for a while
## after the aircraft has left our vision, which is when it matters.
var air_seen: float = 0.0
var defend_x: float = 0.0
var defend_y: float = 0.0
var energy_stall_time: float = 0.0
var metal_waste_time: float = 0.0

var counts: Dictionary = {}


func _init(w: IdWorld, p: IdPlayer) -> void:
	world = w
	player = p
	cfg = LEVELS.get(p.ai_level, LEVELS["normal"])
	p.income_multiplier = float(cfg["income"])
	R = IdUnitDefs.roster(p.faction)

	base_x = p.start_x
	base_y = p.start_y

	var enemy: IdPlayer = null
	for other in w.players:
		if other.team != p.team:
			enemy = other
			break
	enemy_x = enemy.start_x if enemy != null else w.map.width - base_x
	enemy_y = enemy.start_y if enemy != null else w.map.height - base_y

	var to_enemy: float = atan2(enemy_y - base_y, enemy_x - base_x)
	stage_x = base_x + cos(to_enemy) * 320.0
	stage_y = base_y + sin(to_enemy) * 320.0

	timer = w.rng.next() * float(cfg["think"])


## Roster slot -> definition id, or "" when this faction has no unit in that
## slot. A faction may legitimately lack one (no big reactor, say), and the
## build order has to skip it rather than trip over a null.
func slot(name: String) -> String:
	var v: Variant = R.get(name)
	return String(v) if v != null else ""


func update(dt: float) -> void:
	timer -= dt
	if timer > 0.0:
		return
	timer = float(cfg["think"])
	think(float(cfg["think"]))


func think(dt: float) -> void:
	var p: IdPlayer = player

	var own: Array[IdEntity] = world.units_of(p.index)
	var c: Dictionary = {}
	var builders: Array[IdEntity] = []
	var factories: Array[IdEntity] = []
	var army: Array[IdEntity] = []

	for e in own:
		if e.under_construction:
			c[e.def_id] = int(c.get(e.def_id, 0))
			var wip: String = e.def_id + "_wip"
			c[wip] = int(c.get(wip, 0)) + 1
			continue
		c[e.def_id] = int(c.get(e.def_id, 0)) + 1
		if bool(e.def.get("factory", false)):
			factories.append(e)
		elif float(e.def.get("buildPower", 0.0)) > 0.0 and not bool(e.def.get("assistOnly", false)):
			builders.append(e)
		if (
			not e.weapons.is_empty()
			and float(e.def.get("speed", 0.0)) > 0.0
			and not bool(e.def.get("isCommander", false))
		):
			army.append(e)
	counts = c

	# Count what is flying against us, from what we can currently see.
	var flying := 0
	var fog: IdFogMap = world.fog[p.index]
	for other in world.entities:
		if not other.alive or String(other.def.get("layer", "ground")) != "air":
			continue
		if world.players[other.player].team == p.team:
			continue
		if not fog.is_visible_at(other.x, other.y):
			continue
		flying += 1
	air_seen = maxf(float(flying), air_seen * 0.985)

	if p.stalling_energy:
		energy_stall_time += dt
	else:
		energy_stall_time = maxf(0.0, energy_stall_time - dt * 0.5)
	if p.metal_wasted > 0.5:
		metal_waste_time += dt
	else:
		metal_waste_time = maxf(0.0, metal_waste_time - dt * 0.5)

	_manage_builders(builders, c)
	_manage_factories(factories, c)
	_manage_army(army)


# ------------------------------------------------------------- building

func _manage_builders(builders: Array[IdEntity], c: Dictionary) -> void:
	for b in builders:
		# Hard energy stall with a builder tied up on something it cannot pay
		# for: drop a solar collector first. Solar is the only structure that
		# costs no energy to build, so it is always affordable.
		if not b.orders.is_empty():
			var order: Dictionary = b.orders[0]
			var stalled: bool = player.energy_ratio < 0.25 and energy_stall_time > 2.0
			if (
				stalled
				and String(order.get("type", "")) == "build"
				and String(order.get("defId", "")) != slot("energy")
			):
				var spot: Dictionary = find_build_spot(slot("energy"), b)
				if not spot.is_empty():
					b.orders.insert(0, {
						"type": "build", "defId": slot("energy"),
						"x": spot["x"], "y": spot["y"],
						"cx": spot["cx"], "cy": spot["cy"],
					})
					energy_stall_time = 0.0
			continue

		# Work down the priority list. A structure we cannot place right now
		# must not block everything below it, which is what happens if we only
		# ever consider the single top choice.
		for want in build_priorities(c, b):
			var spot: Dictionary = find_build_spot(want, b)
			if spot.is_empty():
				continue
			b.orders.append({
				"type": "build", "defId": want,
				"x": spot["x"], "y": spot["y"],
				"cx": spot["cx"], "cy": spot["cy"],
			})
			# Count it immediately so two builders do not start the same thing.
			var wip: String = want + "_wip"
			c[wip] = int(c.get(wip, 0)) + 1
			break


## Structures this builder should consider, best first.
func build_priorities(c: Dictionary, builder: IdEntity) -> Array[String]:
	var p: IdPlayer = player
	var time: float = world.time
	var out: Array[String] = []

	var n := func(id: String) -> int:
		if id == "":
			return 0
		return int(c.get(id, 0)) + int(c.get(id + "_wip", 0))
	var add := func(id: String) -> void:
		if id != "" and not out.has(id):
			out.append(id)

	# Never start new work while badly metal-starved; finish what we have.
	if p.metal_ratio < 0.35 and p.metal < 60.0:
		return out

	var mexes: int = n.call(slot("mex"))
	var energy_income: float = p.energy_income
	var factories: int = n.call(slot("factory")) + n.call(slot("factoryT2"))
	var has_spot: bool = not find_metal_spot(builder).is_empty()

	# Energy has to stay ahead of what our build power can spend, but not by
	# so much that we pour the whole economy into power plants.
	var energy_target: float = 60.0 + p.build_power_used * 0.35

	# Running the bank dry stops everything, so energy comes first whenever we
	# are actually short of it. The cheap plant costs no energy to build, which
	# is what makes it the way out of a stall.
	if p.energy < p.energy_storage * 0.3 or energy_income < 24.0:
		add.call(slot("energy"))

	# Anti-air goes near the top the moment something is actually flying at us.
	# It is not an improvement to make when there is spare time; it is the
	# difference between having an answer and not having one.
	if air_seen > 0.0 and n.call(slot("antiAir")) < 1 + int(air_seen / 2.0):
		add.call(slot("antiAir"))

	if mexes < 4 and has_spot:
		add.call(slot("mex"))
	if energy_income < 42.0 and n.call(slot("energy")) + n.call(slot("energyAlt")) < 6:
		add.call(slot("energy") if energy_income < 30.0 else _energy_alt())
	if factories == 0:
		add.call(slot("factory"))

	# An air plant is a strategic opening rather than an incremental one, so it
	# sits with the factories: aircraft ignore the map, which is worth a great
	# deal on ground this broken. Below the first factory, above the steady
	# drip of power plants and turrets that would otherwise crowd it out.
	if (
		factories > 0 and time > float(cfg["air_time"])
		and p.metal_income > 14.0 and n.call(slot("airFactory")) < 1
	):
		add.call(slot("airFactory"))

	# A barracks is the cheapest production in the game and finishes in a third
	# of the time a bot lab takes, so it goes up beside the first factory
	# rather than after it -- troops are what covers the gap while the real
	# army is still being built.
	if time > float(cfg["barracks_time"]) and n.call(slot("barracks")) < 1:
		add.call(slot("barracks"))

	# One tower on spec once the game is old enough that someone could have
	# aircraft, so the first raid is not free. Exactly one: anti-air shoots at
	# nothing else, so every tower past the first is metal that buys no ground
	# until an aircraft actually shows up.
	if time > float(cfg["air_time"]) * 1.2 and n.call(slot("antiAir")) < 1:
		add.call(slot("antiAir"))
	if has_spot:
		add.call(slot("mex"))
	# Infantry scale by number, not by quality, so a second barracks is worth
	# more than a second bot lab once there is income to keep both busy.
	if p.metal_income > 20.0 and n.call(slot("barracks")) < 2:
		add.call(slot("barracks"))

	if energy_stall_time > 1.5 or energy_income < energy_target:
		# A big reactor is a mid-game commitment, not an opening move: it costs
		# as much metal as a dozen tanks, so it only makes sense once there is
		# a spread of cheap plants already up and the income to absorb the lump.
		var big_ready: bool = (
			slot("energyBig") != ""
			and p.metal_income > 26.0
			and n.call(slot("energy")) >= 4
			and n.call(slot("energyBig")) < 1 + int(p.metal_income / 45.0)
		)
		add.call(slot("energyBig") if big_ready else slot("energy"))

	# More production capacity as the economy grows: extra factories, and
	# assist turrets beside them so queued units actually come out quickly.
	var factory_target: int = mini(4, 1 + int(p.metal_income / 14.0))
	if factories < factory_target:
		add.call(slot("factory"))
	var nano_target: int = mini(8, int(p.metal_income / 5.0))
	if factories > 0 and n.call(slot("nano")) < nano_target:
		add.call(slot("nano"))

	var want_defence: bool = time > float(cfg["defence_time"]) or time < defend_until
	if want_defence and n.call(slot("defence")) < 2 + int(time / 240.0):
		add.call(slot("defence"))
	if time > 180.0 and n.call(slot("radar")) < 1:
		add.call(slot("radar"))
	if time > float(cfg["tech_time"]) and n.call(slot("factoryT2")) == 0 and p.metal_income > 9.0:
		add.call(slot("factoryT2"))
	if metal_waste_time > 3.0 and n.call(slot("mstore")) < 2:
		add.call(slot("mstore"))
	if p.energy > p.energy_storage * 0.9 and p.metal_income < 20.0 and n.call(slot("converter")) < 6:
		add.call(slot("converter"))
	if n.call(slot("estore")) < 2 and energy_income > 120.0:
		add.call(slot("estore"))
	if time > 300.0 and n.call(slot("defenceT2")) < 2 and n.call(slot("factoryT2")) > 0:
		add.call(slot("defenceT2"))

	# Deliberately no catch-all fallback: a builder with nothing worth building
	# will assist the nearest factory instead, which turns spare metal into
	# army rather than into yet another power plant.
	return out


## The alternative power plant, falling back to the basic one.
func _energy_alt() -> String:
	var alt: String = slot("energyAlt")
	return alt if alt != "" else slot("energy")


## Best free metal spot this builder could actually use. Spots whose footprint
## is obstructed are skipped, otherwise one unbuildable spot would sit at the
## top of the list forever and stall the whole build order.
func find_metal_spot(builder: IdEntity) -> Dictionary:
	var map: IdGameMap = world.map
	var def: Dictionary = IdUnitDefs.get_def(slot("mex"), player.faction)
	var max_range: float = 900.0 if bool(builder.def.get("isCommander", false)) else 2400.0
	var footprint: int = int(def.get("footprint", 0))

	var candidates: Array[Dictionary] = []
	for s in map.metal_spots:
		if bool(s.get("taken", false)):
			continue
		var d_base: float = IdMath.dist(s["x"], s["y"], base_x, base_y)
		if d_base > max_range:
			continue
		var d_enemy: float = IdMath.dist(s["x"], s["y"], enemy_x, enemy_y)
		# Prefer spots close to us and far from them.
		candidates.append({"spot": s, "score": -d_base + d_enemy * 0.35})
	candidates.sort_custom(func(a, b): return float(a["score"]) > float(b["score"]))

	for cand in candidates:
		var s: Dictionary = cand["spot"]
		var snapped: Dictionary = map.snap_footprint(s["x"], s["y"], footprint)
		if not IdOrders.can_build_here(world, player.index, def, snapped["cx"], snapped["cy"]):
			continue
		# Stash the footprint on the spot so find_build_spot does not repeat
		# the snap; spots are shared dictionaries, so this rides along.
		s["_snapped"] = snapped
		return s
	return {}


func find_build_spot(def_id: String, builder: IdEntity) -> Dictionary:
	var map: IdGameMap = world.map
	var def: Dictionary = IdUnitDefs.get_def(def_id, player.faction)
	var footprint: int = int(def.get("footprint", 0))

	if bool(def.get("needsMetalSpot", false)):
		var spot: Dictionary = find_metal_spot(builder)
		if spot.is_empty():
			return {}
		return spot.get("_snapped", map.snap_footprint(spot["x"], spot["y"], footprint))

	# Defences go toward the enemy; everything else clusters around the base.
	var origin_x: float = base_x
	var origin_y: float = base_y
	var min_r: float = 110.0
	var max_r: float = 520.0
	if def_id == slot("defence") or def_id == slot("defenceT2"):
		var a: float = atan2(enemy_y - base_y, enemy_x - base_x)
		origin_x = base_x + cos(a) * 300.0
		origin_y = base_y + sin(a) * 300.0
		min_r = 0.0
		max_r = 320.0
	elif def_id == slot("radar"):
		min_r = 200.0
		max_r = 600.0
	elif def_id == slot("nano"):
		# Park nano turrets next to a factory so they speed up unit production.
		for e in world.units_of(player.index):
			if bool(e.def.get("factory", false)) and not e.under_construction:
				origin_x = e.x
				origin_y = e.y
				min_r = float(e.def.get("footprintPx", 0.0)) * 0.6 + 30.0
				max_r = float(
					IdUnitDefs.get_def(slot("nano"), player.faction).get("buildRange", 300.0)
				) * 0.8
				break

	var rng_offset: float = world.rng.next() * TAU
	var r: float = min_r
	while r <= max_r:
		var steps: int = maxi(8, int((r / 34.0) * 5.0))
		for i in range(steps):
			var a: float = rng_offset + (float(i) / float(steps)) * TAU
			var x: float = origin_x + cos(a) * r
			var y: float = origin_y + sin(a) * r
			var snapped: Dictionary = map.snap_footprint(x, y, footprint)
			# Leave a one-cell gap so the base does not seal itself in.
			if not map.can_place(snapped["cx"] - 1, snapped["cy"] - 1, footprint + 2):
				continue
			if not IdOrders.can_build_here(world, player.index, def, snapped["cx"], snapped["cy"]):
				continue
			return snapped
		r += 34.0
	return {}


# ------------------------------------------------------------ production

func _manage_factories(factories: Array[IdEntity], c: Dictionary) -> void:
	var p: IdPlayer = player
	var n := func(id: String) -> int:
		return int(c.get(id, 0)) + int(c.get(id + "_wip", 0))

	for f in factories:
		var queued: int = 0
		for it in f.factory_queue:
			queued += int(it["count"])
		var queue_cap: int = 6 if p.metal_income > 25.0 else 4
		if queued >= queue_cap:
			continue
		# Do not pile up a queue we cannot pay for.
		if p.metal_ratio < 0.4 and queued >= 1:
			continue

		var pick: String
		if f.def_id == slot("barracks"):
			# Troopers are the body of the squad; lancers are what stops
			# armour; the AA team only earns its cost once something is in the
			# air. Keep the mix weighted to riflemen -- a platoon of nothing
			# but rocket troops evaporates the moment it meets infantry.
			if air_seen > 0.0 and n.call(slot("aaInfantry")) < 2:
				pick = slot("aaInfantry")
			else:
				pick = slot("trooper") if world.rng.next() < 0.62 else slot("lancer")
		elif f.def_id == slot("airFactory"):
			# Enough interceptors to contest the sky, then things that hit
			# ground.
			var fighters: int = n.call(slot("fighter"))
			if air_seen > float(fighters) * 1.5 or fighters < 2:
				pick = slot("fighter")
			else:
				pick = slot("gunship") if world.rng.next() < 0.55 else slot("bomber")
		elif f.def_id == slot("factoryT2"):
			if n.call(slot("builderT2")) < 2:
				pick = slot("builderT2")
			else:
				pick = slot("heavy") if world.rng.next() < 0.68 else slot("artillery")
		else:
			var builder_count: int = n.call(slot("builder")) + n.call(slot("builderT2"))
			if builder_count < int(cfg["builders"]):
				pick = slot("builder")
			else:
				var rv: float = world.rng.next()
				if rv < 0.5:
					pick = slot("assault")
				elif rv < 0.82:
					pick = slot("skirmisher")
				else:
					pick = slot("raider")

		var found: bool = false
		for it in f.factory_queue:
			if String(it["defId"]) == pick:
				it["count"] = int(it["count"]) + 1
				found = true
				break
		if not found:
			f.factory_queue.append({"defId": pick, "count": 1, "origCount": 1})

		if not f.has_rally:
			f.has_rally = true
			f.rally = Vector2(stage_x, stage_y)


# ----------------------------------------------------------------- army

func _manage_army(army: Array[IdEntity]) -> void:
	var threat: Vector2 = find_base_threat()
	if is_finite(threat.x):
		defend_until = world.time + 25.0
		defend_x = threat.x
		defend_y = threat.y

	if world.time < defend_until:
		# Defend: everything converges on the intrusion.
		for u in army:
			var busy: bool = (
				not u.orders.is_empty()
				and String(u.orders[0].get("type", "")) == "attackMove"
				and IdMath.dist(u.orders[0]["x"], u.orders[0]["y"], defend_x, defend_y) < 220.0
			)
			if busy:
				continue
			u.orders.clear()
			u.orders.append({"type": "attackMove", "x": defend_x, "y": defend_y})
		attacking = false
		return

	var idle: Array[IdEntity] = []
	for u in army:
		if u.orders.is_empty():
			idle.append(u)

	var wave_size: int = mini(
		int(cfg["max_wave"]),
		int(float(cfg["wave_base"]) + world.time * float(cfg["wave_growth"]))
	)

	if attacking:
		# Keep a running push supplied: idle units head to the current target.
		for u in idle:
			u.orders.append({
				"type": "attackMove", "x": attack_target.x, "y": attack_target.y,
			})
		if army.is_empty():
			attacking = false
		# Re-target when the previous objective is gone.
		if world.time > retarget_at:
			attack_target = pick_attack_target()
			retarget_at = world.time + 12.0
			for u in army:
				u.orders.clear()
				u.orders.append({
					"type": "attackMove", "x": attack_target.x, "y": attack_target.y,
				})
		return

	# Trigger on the size of the whole army, not just the units that happen to
	# be idle this instant: units jostling at a crowded rally point still count
	# toward the push.
	if army.size() >= wave_size:
		attack_target = pick_attack_target()
		retarget_at = world.time + 15.0
		attacking = true
		for u in army:
			u.orders.clear()
			u.orders.append({
				"type": "attackMove", "x": attack_target.x, "y": attack_target.y,
			})
	else:
		# Gather at the staging point while we build up.
		for u in idle:
			if IdMath.dist(u.x, u.y, stage_x, stage_y) > 260.0:
				u.orders.append({
					"type": "move",
					"x": stage_x + (world.rng.next() - 0.5) * 190.0,
					"y": stage_y + (world.rng.next() - 0.5) * 190.0,
				})


## Prefer a remembered enemy structure; fall back to their start position.
func pick_attack_target() -> Vector2:
	var fog: IdFogMap = world.fog[player.index]
	var best: Vector2 = Vector2(enemy_x, enemy_y)
	var best_score: float = -INF
	var found: bool = false
	for id in fog.memory:
		var mem: Dictionary = fog.memory[id]
		if world.players[mem["player"]].team == player.team:
			continue
		var d: float = IdMath.dist(mem["x"], mem["y"], base_x, base_y)
		var score: float = -d
		# Judge remembered structures by what they do, not by which faction
		# built them - the enemy may not share our roster.
		var mem_def: Dictionary = IdUnitDefs.base_def(mem["def_id"])
		if not mem_def.is_empty():
			if bool(mem_def.get("needsMetalSpot", false)):
				score += 400.0
			if bool(mem_def.get("factory", false)):
				score += 900.0
			if not (mem_def.get("weapons", []) as Array).is_empty():
				score -= 500.0
		if score > best_score:
			best_score = score
			best = Vector2(mem["x"], mem["y"])
			found = true
	return best if found else Vector2(enemy_x, enemy_y)


## Any enemy unit close to our base, or any of our buildings taking fire.
## Returns a position, or a NAN vector when the base is quiet.
func find_base_threat() -> Vector2:
	for e in world.entities:
		if not e.alive or e.player != player.index:
			continue
		if world.time - e.last_damage_time < 4.0 and IdMath.dist(e.x, e.y, base_x, base_y) < 1100.0:
			var attacker: IdEntity = world.get_entity(e.last_attacker_id)
			if attacker != null:
				return Vector2(attacker.x, attacker.y)
			return Vector2(e.x, e.y)
	return Vector2(NAN, NAN)
