class_name IdTeamColour
extends RefCounted

## Recolours the placeholder team materials on an instantiated model.
##
## Models are exported with Team, TeamDark and TeamLight as neutral grey so a
## single asset serves every player. This walks the instance and overrides
## those surfaces, leaving hull, track and glow materials alone.

## How far a painted (textured) surface is pulled towards the team colour.
const TEXTURE_TINT := 0.32

const SLOTS := {
	"Team": "primary",
	"TeamDark": "dark",
	"TeamLight": "light",
}

static func apply(root: Node, colours: Dictionary) -> void:
	for child in root.get_children():
		if child is MeshInstance3D:
			_apply_to_mesh(child, colours)
		if child.get_child_count() > 0:
			apply(child, colours)

static func _apply_to_mesh(mi: MeshInstance3D, colours: Dictionary) -> void:
	var mesh: Mesh = mi.mesh
	if mesh == null:
		return
	for s in mesh.get_surface_count():
		var base: Material = mesh.surface_get_material(s)
		if base == null:
			continue
		var slot: String = SLOTS.get(base.resource_name, "")
		if slot == "":
			# An artist's model has no Team slots; it is painted. Until those
			# carry a team mask, the whole surface takes a tint of the team
			# colour, which is what most RTS games did before masks anyway.
			if base is BaseMaterial3D and (base as BaseMaterial3D).albedo_texture != null:
				var tinted: BaseMaterial3D = base.duplicate()
				tinted.albedo_color = Color.WHITE.lerp(colours["primary"], TEXTURE_TINT)
				mi.set_surface_override_material(s, tinted)
			continue
		var mat: StandardMaterial3D = base.duplicate()
		mat.albedo_color = colours[slot]
		mat.metallic = 0.55
		mat.roughness = 0.42
		mi.set_surface_override_material(s, mat)
