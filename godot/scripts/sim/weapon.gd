class_name IdWeapon
extends RefCounted

## Per-entity weapon state. The shared, immutable part lives in `def`; the
## mutable cooldown and aim live here so two units of the same type do not
## fire in lockstep.

var def: Dictionary = {}
var cooldown: float = 0.0
var target_id: int = 0
var aim: float = 0.0
var last_fire: float = -99.0


func _init(weapon_def: Dictionary, initial_cooldown: float) -> void:
	def = weapon_def
	cooldown = initial_cooldown
