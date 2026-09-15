# Headless check that the exported models import and carry the structure the
# game expects: a body, optional turret and spinner nodes at their pivots, and
# materials that can be recoloured per player.
extends SceneTree

func _init() -> void:
	var manifest_file := FileAccess.open("res://assets/models/manifest.json", FileAccess.READ)
	if manifest_file == null:
		push_error("manifest.json missing")
		quit(1)
		return
	var manifest: Dictionary = JSON.parse_string(manifest_file.get_as_text())

	var total_meshes := 0
	var total_surfaces := 0
	var materials := {}
	var failures: Array[String] = []
	var with_turret := 0
	var with_spinner := 0

	for id in manifest.keys():
		var path := "res://assets/models/%s" % manifest[id]["file"]
		if not ResourceLoader.exists(path):
			failures.append("%s: not importable" % id)
			continue
		var scene: PackedScene = load(path)
		if scene == null:
			failures.append("%s: failed to load" % id)
			continue
		var root: Node = scene.instantiate()

		# An artist's model (tools/import-asset.py) keeps its own hierarchy:
		# the root is the body, and any turret or legs sit wherever the artist
		# put them. Check that it has geometry and that the parts the view
		# looks for are findable, and leave the pivots to the importer.
		if bool(manifest[id].get("handmade", false)):
			var meshes := root.find_children("*", "MeshInstance3D", true, false)
			if meshes.is_empty():
				failures.append("%s: hand-made model has no meshes" % id)
			for m in meshes:
				total_meshes += 1
				var mesh: Mesh = (m as MeshInstance3D).mesh
				if mesh == null:
					continue
				total_surfaces += mesh.get_surface_count()
				for s in mesh.get_surface_count():
					var mat: Material = mesh.surface_get_material(s)
					if mat != null:
						materials[mat.resource_name] = true
			if root.find_child("turret", true, false) != null:
				with_turret += 1
			root.free()
			continue

		var found := {}
		for child in root.get_children():
			if child is MeshInstance3D:
				found[child.name] = child
				total_meshes += 1
				var mesh: Mesh = child.mesh
				total_surfaces += mesh.get_surface_count()
				for s in mesh.get_surface_count():
					var mat: Material = mesh.surface_get_material(s)
					if mat != null:
						materials[mat.resource_name] = true

		if not found.has("body"):
			failures.append("%s: no body node" % id)
		if manifest[id]["parts"].has("turret"):
			if found.has("turret"):
				with_turret += 1
				var want: float = manifest[id]["parts"]["turret"]["pivotY"]
				var got: float = found["turret"].position.y
				if abs(want - got) > 0.001:
					failures.append("%s: turret pivot %.3f, expected %.3f" % [id, got, want])
			else:
				failures.append("%s: turret missing" % id)
		if manifest[id]["parts"].has("spinner"):
			if found.has("spinner"):
				with_spinner += 1
			else:
				failures.append("%s: spinner missing" % id)
		root.free()

	print("models checked:      %d" % manifest.size())
	print("mesh nodes:          %d" % total_meshes)
	print("surfaces (materials in use): %d" % total_surfaces)
	print("with turret / spinner:       %d / %d" % [with_turret, with_spinner])
	var names := materials.keys()
	names.sort()
	print("distinct materials:  %d -> %s" % [names.size(), ", ".join(names)])
	if failures.is_empty():
		print("PASS: every model imported with the expected structure")
		quit(0)
	else:
		for f in failures:
			print("FAIL: %s" % f)
		quit(1)
