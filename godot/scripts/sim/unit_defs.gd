class_name IdUnitDefs
extends RefCounted

## Unit and structure definitions, loaded from the shared data files.
##
## The stats are the game's design rather than its implementation, so both
## builds read the same JSON: a balance change is one edit, not two that drift.
## Faction modifiers are applied here and the result cached, exactly as the
## reference build does.

## Armour classes. See the table in src/sim/defs.js for what each weapon does
## to them; the multipliers live on the weapons and travel in the data file.
const ARMOUR_STANDARD := "standard"
const ARMOUR_INFANTRY := "infantry"

const BUILD_CELL: int = 16

static var _defs: Dictionary = {}
static var _factions: Dictionary = {}
static var _faction_order: Array = []
static var _hotkeys: Dictionary = {}
static var _resolved: Dictionary = {}
static var _loaded: bool = false

static func load_data() -> void:
	if _loaded:
		return
	_defs = _read_json("res://data/units.json")
	var f := _read_json("res://data/factions.json")
	_factions = f.get("factions", {})
	_faction_order = f.get("order", [])
	_hotkeys = f.get("hotkeys", {})
	_loaded = true

static func _read_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("missing data file: %s" % path)
		return {}
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("malformed data file: %s" % path)
		return {}
	return parsed

static func faction_ids() -> Array:
	load_data()
	return _faction_order

static func faction(id: String) -> Dictionary:
	load_data()
	return _factions.get(id, {})

static func roster(faction_id: String) -> Dictionary:
	load_data()
	var f: Dictionary = _factions.get(faction_id, {})
	if f.is_empty():
		f = _factions.get("vanguard", {})
	return f.get("roster", {})

static func hotkey(def_id: String) -> String:
	load_data()
	return _hotkeys.get(def_id, "")

static func all_ids() -> Array:
	load_data()
	return _defs.keys()

## The unmodified definition, with no faction applied. Used where something
## has to be judged by what it does rather than by who built it.
static func base_def(def_id: String) -> Dictionary:
	load_data()
	return _defs.get(def_id, {})


## A definition with its owning faction's modifiers baked in.
static func get_def(def_id: String, faction_id: String) -> Dictionary:
	load_data()
	var key := "%s|%s" % [def_id, faction_id]
	if _resolved.has(key):
		return _resolved[key]

	var base: Dictionary = _defs.get(def_id, {})
	if base.is_empty():
		push_error("unknown unit definition: %s" % def_id)
		return {}

	var f: Dictionary = _factions.get(faction_id, _factions.get("vanguard", {}))
	var m: Dictionary = f.get("mods", {})
	var mod := func(name: String) -> float:
		return float(m.get(name, 1.0))

	var d: Dictionary = base.duplicate(true)
	d["faction"] = faction_id
	d["hp"] = roundi(float(base.get("hp", 1)) * mod.call("hp"))
	d["metal"] = roundi(float(base.get("metal", 0)) * mod.call("cost"))
	d["energy"] = roundi(float(base.get("energy", 0)) * mod.call("cost"))
	d["buildTime"] = roundi(float(base.get("buildTime", 1)) * mod.call("cost"))
	if base.has("speed"):
		d["speed"] = float(base["speed"]) * mod.call("speed")

	var max_range := 0.0
	if base.has("weapons"):
		var weapons: Array = []
		for w in base["weapons"]:
			var wc: Dictionary = (w as Dictionary).duplicate(true)
			wc["damage"] = roundi(float(w.get("damage", 0)) * mod.call("damage"))
			wc["range"] = roundi(float(w.get("range", 0)) * mod.call("range"))
			max_range = maxf(max_range, float(wc["range"]))
			weapons.append(wc)
		d["weapons"] = weapons
	else:
		d["weapons"] = []
	d["maxWeaponRange"] = max_range
	# Which layers this thing can shoot at, worked out once rather than walked
	# per tick: the AI reads it to decide whether it needs anti-air, and target
	# scoring reads it to know what an aircraft should kill first.
	d["layer"] = String(base.get("layer", "ground"))
	var hits_air := false
	var hits_ground := false
	for w in d["weapons"]:
		var t := String((w as Dictionary).get("targets", "ground"))
		if t == "air" or t == "both":
			hits_air = true
		if t != "air":
			hits_ground = true
	d["hitsAir"] = hits_air
	d["hitsGround"] = hits_ground
	# Armour class decides what a shell landing on this thing is worth. Infantry
	# are the only class that differs from standard today, but the field is on
	# everything so the damage path never has to ask whether it exists.
	d["armour"] = String(base.get("armour", ARMOUR_STANDARD))
	d["isInfantry"] = d["armour"] == ARMOUR_INFANTRY
	# How many bodies one build order produces. Infantry arrive as a squad.
	d["squad"] = int(base.get("squad", 1))

	var footprint := int(base.get("footprint", 0))
	d["footprintPx"] = footprint * BUILD_CELL
	if String(base.get("kind", "")) == "building":
		d["radius"] = float(d["footprintPx"]) * 0.5
	else:
		d["radius"] = float(base.get("radius", 10))

	var wreck_fraction := 0.4
	if base.has("wreckFraction"):
		wreck_fraction = float(base["wreckFraction"])
	d["wreckMetal"] = roundi(float(d["metal"]) * wreck_fraction)

	_resolved[key] = d
	return d
