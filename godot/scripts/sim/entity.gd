class_name IdEntity
extends RefCounted

## One thing in the world: a unit, a building, or a nanoframe becoming one.
##
## Fields are declared rather than bagged into a Dictionary because the tick
## touches most of them every frame, and typed members are read directly
## instead of hashed.

var id: int = 0
var def_id: String = ""
var def: Dictionary = {}
var player: int = 0

var x: float = 0.0
var y: float = 0.0
var cx: int = 0
var cy: int = 0
var heading: float = 0.0
var radius: float = 12.0
var is_building: bool = false
var alive: bool = true

var max_hp: float = 1.0
var hp: float = 1.0
var under_construction: bool = false
var build_progress: float = 1.0
var build_power_applied: float = 0.0

var vx: float = 0.0
var vy: float = 0.0
var speed: float = 0.0
var path: Array = []
var path_index: int = 0
var path_pending: bool = false
var has_move_goal: bool = false
var move_goal: Vector2 = Vector2.ZERO
## Arrival tolerance for the current goal; 0 means "use the default".
var move_slack: float = 0.0
var has_path_goal: bool = false
var path_goal: Vector2 = Vector2.ZERO
var stuck_timer: float = 0.0
var last_x: float = 0.0
var last_y: float = 0.0

## Order queue; each order is a Dictionary with at least a "type" key.
var orders: Array[Dictionary] = []
var active_job: Dictionary = {}

var weapons: Array[IdWeapon] = []
var turret_angle: float = 0.0
var target_id: int = 0
## Earliest tick this unit may search for a new target again. Searching is the
## most expensive thing a unit does, and a unit that found nothing this tick
## will almost certainly find nothing on the next one either.
var next_scan_tick: int = 0
var last_damage_time: float = -99.0
var last_attacker_id: int = 0

## Each item is {"defId": String, "count": int, "origCount": int}.
var factory_queue: Array[Dictionary] = []
var factory_progress: float = 0.0
var repeat: bool = false
var has_rally: bool = false
var rally: Vector2 = Vector2.ZERO

## The metal spot this extractor sits on, or an empty dictionary.
var metal_spot: Dictionary = {}
var selected: bool = false
var idle_since: float = 0.0


func position() -> Vector2:
	return Vector2(x, y)


func health_fraction() -> float:
	return clampf(hp / maxf(max_hp, 0.0001), 0.0, 1.0)
