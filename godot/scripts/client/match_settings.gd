class_name IdMatchSettings

## What the front end chose for the next match.
##
## Static rather than an autoload so the game scene can be run straight from
## the editor or the command line with sensible defaults, without the menu
## having to exist first.

static var player_faction: String = "vanguard"
static var enemy_faction: String = "legion"
## How many AI opponents, each on its own team: one is a duel, more is a
## free-for-all on a map laid out in quarters.
static var opponents: int = 1

## "ffa" puts every side on its own team; "2v2" pairs you with the first
## opponent against the other two. Only meaningful with three opponents.
static var team_mode: String = "ffa"
static var difficulty: String = "normal"
static var map_seed: int = 12345


## The player list for a match with these settings.
##
## The first opponent takes the chosen faction and the rest take the others in
## turn, so a free-for-all is a mix rather than three copies of one side.
static func player_specs(autoplay: bool = false) -> Array:
	var ids: Array = IdUnitDefs.faction_ids()
	var specs: Array = [{
		"name": "%s AI" % IdUnitDefs.faction(player_faction)["name"] if autoplay else "Commander",
		"faction": player_faction,
		"is_ai": autoplay,
		"ai_level": difficulty,
	}]

	var order: Array = [enemy_faction]
	for id in ids:
		if id != enemy_faction:
			order.append(id)

	for i in range(maxi(opponents, 1)):
		var faction: String = order[i % order.size()]
		specs.append({
			"name": "%s AI" % IdUnitDefs.faction(faction)["name"],
			"faction": faction,
			"is_ai": true,
			"ai_level": difficulty,
		})

	# Starts run round the map in order, so pairing neighbours gives each team
	# a shared front rather than two separate wars.
	var paired: bool = team_mode == "2v2" and specs.size() == 4
	for i in range(specs.size()):
		specs[i]["team"] = (i / 2) if paired else i
	return specs
