class_name IdTeamColour
extends RefCounted

## Recolours the placeholder team materials on an instantiated model.
##
## Models are exported with Team, TeamDark and TeamLight as neutral grey so a
## single asset serves every player. This walks the instance and overrides
## those surfaces, leaving hull, track and glow materials alone.

## How far a painted (textured) surface is pulled towards the team colour.
const TEXTURE_TINT := 0.32
## Flat paint has no detail to carry a stronger tint: at the texture's share
## an olive hull came out as pale team-coloured grey.
const PAINT_TINT := 0.18

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
			# Paint is a texture, or a flat colour the importer gave a
			# material whose textures did not arrive (Painted_*).
			if base is BaseMaterial3D and (
				(base as BaseMaterial3D).albedo_texture != null
				or base.resource_name.begins_with("Painted_")
			):
				var tinted: BaseMaterial3D = base.duplicate()
				# Blended over the material's own colour: on a painted
				# surface that colour is the paint, and replacing it with
				# a near-white tint left the whole model bleached.
				var share: float = (
					TEXTURE_TINT if (base as BaseMaterial3D).albedo_texture != null
					else PAINT_TINT
				)
				tinted.albedo_color = tinted.albedo_color.lerp(colours["primary"], share)
				mi.set_surface_override_material(s, tinted)
			continue
		var mat: StandardMaterial3D = base.duplicate()
		mat.albedo_color = colours[slot]
		mat.metallic = 0.55
		mat.roughness = 0.42
		mi.set_surface_override_material(s, mat)
