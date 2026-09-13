extends SceneTree

## Checks the data loader against the same resolved values the reference build
## produces, and that every faction roster is complete and reachable.

var _failures := 0

func _check(name: String, ok: bool, detail: String = "") -> void:
	print("  %s  %s%s" % ["PASS" if ok else "FAIL", name, ("  (%s)" % detail) if detail != "" else ""])
	if not ok:
		_failures += 1

func _init() -> void:
	IdUnitDefs.load_data()
	var ids := IdUnitDefs.all_ids()
	_check("definitions loaded", ids.size() == 40, "%d definitions" % ids.size())
	_check("factions loaded", IdUnitDefs.faction_ids().size() == 3,
		", ".join(IdUnitDefs.faction_ids()))

	# Resolved stats must match the reference build exactly.
	var f := FileAccess.open("res://data/parity-fixture.json", FileAccess.READ)
	var fx: Dictionary = JSON.parse_string(f.get_as_text())
	var mismatches: Array[String] = []
	for key in fx["defs"].keys():
		var parts: PackedStringArray = key.split("|")
		var d := IdUnitDefs.get_def(parts[0], parts[1])
		var want: Dictionary = fx["defs"][key]
		for field in ["hp", "metal", "energy", "buildTime", "maxWeaponRange", "wreckMetal"]:
			if int(d[field]) != int(want[field]):
				mismatches.append("%s.%s: %d vs %d" % [key, field, int(d[field]), int(want[field])])
		if want["speed"] != null:
			if absf(float(d["speed"]) - float(want["speed"])) > 1e-5:
				mismatches.append("%s.speed: %f vs %f" % [key, float(d["speed"]), float(want["speed"])])
		if absf(float(d["radius"]) - float(want["radius"])) > 1e-5:
			mismatches.append("%s.radius" % key)
	_check("resolved stats match the reference build", mismatches.is_empty(),
		"%d checked%s" % [fx["defs"].size(), "" if mismatches.is_empty() else ": " + ", ".join(mismatches)])

	# Every roster slot must resolve, and be reachable in that faction's tree.
	var problems: Array[String] = []
	for fid in IdUnitDefs.faction_ids():
		var r := IdUnitDefs.roster(fid)
		for slot in r.keys():
			var def_id = r[slot]
			if def_id == null:
				continue
			if IdUnitDefs.get_def(String(def_id), fid).is_empty():
				problems.append("%s.%s -> %s" % [fid, slot, def_id])
		var buildable := {}
		for key in ["commander", "builder", "builderT2"]:
			var d := IdUnitDefs.get_def(String(r[key]), fid)
			for b in d.get("build", []):
				buildable[b] = true
		for slot in ["mex", "energy", "factory", "nano", "defence", "radar", "converter"]:
			if r[slot] != null and not buildable.has(r[slot]):
				problems.append("%s: nothing builds %s" % [fid, slot])
		var t1 := {}
		for b in IdUnitDefs.get_def(String(r["factory"]), fid).get("build", []):
			t1[b] = true
		for slot in ["builder", "raider", "assault", "skirmisher"]:
			if r[slot] != null and not t1.has(r[slot]):
				problems.append("%s: factory cannot build %s" % [fid, slot])
	_check("every roster slot resolves and is reachable", problems.is_empty(),
		", ".join(problems) if not problems.is_empty() else "3 factions")

	# Commanders must be flagged and able to build.
	var com_ok := true
	for fid in IdUnitDefs.faction_ids():
		var com := IdUnitDefs.get_def(String(IdUnitDefs.roster(fid)["commander"]), fid)
		if not com.get("isCommander", false) or int(com.get("buildPower", 0)) <= 0:
			com_ok = false
	_check("every faction has a building commander", com_ok)

	print("")
	if _failures == 0:
		print("PASS: definitions load and resolve identically to the reference build")
		quit(0)
	else:
		print("%d failures" % _failures)
		quit(1)
