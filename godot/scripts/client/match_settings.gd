class_name IdMatchSettings

## What the front end chose for the next match.
##
## Static rather than an autoload so the game scene can be run straight from
## the editor or the command line with sensible defaults, without the menu
## having to exist first.

static var player_faction: String = "vanguard"
static var enemy_faction: String = "legion"
static var difficulty: String = "normal"
static var map_seed: int = 12345
