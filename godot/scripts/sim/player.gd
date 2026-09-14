class_name IdPlayer
extends RefCounted

## One side in a match: resources, income rates, and the stall ratios that
## throttle everything spending them.

## Colours are grouped by team, not handed out in a flat row.
##
## A player has to be able to tell an ally from an enemy at a glance, and two
## allies apart when they need to. Each team takes a family, and the players on
## it take shades within that family - so on a team map you and your ally are
## both blue, and the other side is both red.
const TEAM_COLORS: Array = [
	[
		{"primary": "#4aa3ff", "dark": "#1b4f86", "light": "#a8d3ff", "name": "Blue"},
		{"primary": "#49e2e8", "dark": "#18656b", "light": "#a9f3f6", "name": "Cyan"},
	],
	[
		{"primary": "#ff5a4a", "dark": "#8c2a1e", "light": "#ffb2a8", "name": "Red"},
		{"primary": "#ffab3d", "dark": "#8a5410", "light": "#ffd9a3", "name": "Amber"},
	],
	[
		{"primary": "#5ddc7a", "dark": "#1f6b36", "light": "#b6f2c6", "name": "Green"},
		{"primary": "#b7e34a", "dark": "#5c7419", "light": "#e2f5a8", "name": "Lime"},
	],
	[
		{"primary": "#d98cff", "dark": "#6a2f8c", "light": "#ecc6ff", "name": "Violet"},
		{"primary": "#ff7ec4", "dark": "#8c2a60", "light": "#ffc2e2", "name": "Rose"},
	],
]


## The colour for the `slot`-th player on `team_index`.
static func colour_for(team_index: int, slot: int) -> Dictionary:
	var family: Array = TEAM_COLORS[team_index % TEAM_COLORS.size()]
	return family[slot % family.size()]

var index: int = 0
var name: String = ""
var faction: String = "vanguard"
var team: int = 0
var is_ai: bool = false
var ai_level: String = "normal"
var color: Dictionary = {}

var metal: float = 1000.0
var energy: float = 1000.0
var metal_storage: float = 1000.0
var energy_storage: float = 1000.0

## Per-second rates, recomputed every tick for the HUD.
var metal_income: float = 0.0
var energy_income: float = 0.0
var metal_drain: float = 0.0
var energy_drain: float = 0.0
var metal_reclaim: float = 0.0
var build_power_used: float = 0.0

## Stall ratios in [0,1]; 1 means every builder is running at full speed.
var metal_ratio: float = 1.0
var energy_ratio: float = 1.0

## Set by the economy each tick; read by construction and the HUD.
var converter_capacity: float = 0.0
var metal_demand: float = 0.0
var energy_demand: float = 0.0
var metal_wasted: float = 0.0
var energy_wasted: float = 0.0
var stalling_metal: bool = false
var stalling_energy: bool = false

## Difficulty handicap. Human players run at 1.
var income_multiplier: float = 1.0

var defeated: bool = false
var stats: Dictionary = {
	"built": 0, "lost": 0, "killed": 0, "metal_produced": 0.0, "metal_reclaimed": 0.0,
}

var start_x: float = 0.0
var start_y: float = 0.0
var commander_id: int = 0


func _init(player_index: int, opts: Dictionary) -> void:
	index = player_index
	name = opts.get("name", "Player %d" % (player_index + 1))
	faction = opts.get("faction", "vanguard")
	team = int(opts.get("team", player_index))
	is_ai = bool(opts.get("is_ai", false))
	ai_level = opts.get("ai_level", "normal")
	# A provisional colour, in case nothing ever assigns a proper one; the
	# world replaces it once it knows how the teams fell out.
	color = colour_for(team, 0)


func faction_def() -> Dictionary:
	return IdUnitDefs.faction(faction)


## Slot -> definition id for this player's faction.
func roster() -> Dictionary:
	return IdUnitDefs.roster(faction)
