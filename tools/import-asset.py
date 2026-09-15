#!/usr/bin/env python3
"""Bring a hand-made model into the game's asset format.

    python3 tools/import-asset.py --src model.gltf --id heavy --height 30 \
        --turret tower --legs "left thigh:a,right thigh:b" [--yaw 90] [--decimate 0.3]

Runs Blender as a Python module (pip install bpy), so it needs no Blender
install. It loads glTF, .blend or .x3d, and writes assets/models/<id>.glb and
godot/assets/models/<id>.glb in the shape the game expects:

  * Y up, facing +X, feet on y = 0, scaled to --height world units
  * the node matched by --turret renamed `turret`, so the view can aim it
  * each node matched by --legs renamed leg_<n>_<a|b> (its subtree kept), so
    the view can swing it in time with the unit's speed
  * textures packed into the .glb

The procedural models are still built by tools/export-models.mjs; this is
for the ones an artist made. Both land in the same folder under the same
rules, and the game cannot tell them apart.
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector


def log(*a):
    print("[import-asset]", *a, flush=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load(src):
    ext = os.path.splitext(src)[1].lower()
    if ext in (".gltf", ".glb"):
        bpy.ops.import_scene.gltf(filepath=src)
    elif ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=src)
    elif ext == ".x3d":
        bpy.ops.import_scene.x3d(filepath=src)
    elif ext in (".fbx",):
        bpy.ops.import_scene.fbx(filepath=src)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=src)
    else:
        sys.exit(f"unsupported source: {src}")


def mesh_objects():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def world_bounds(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def find_node(pattern):
    """Case-insensitive substring match on object names; the first hit."""
    p = pattern.lower()
    for o in bpy.data.objects:
        if p in o.name.lower():
            return o
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--id", required=True, help="definition id; also the file name")
    ap.add_argument("--height", type=float, required=True, help="world units, feet to top")
    ap.add_argument("--yaw", type=float, default=0.0, help="degrees to turn so the model faces +X")
    ap.add_argument("--turret", default=None, help="substring of the node to aim")
    ap.add_argument("--legs", default="", help='"name:a,name:b,..." leg root nodes and gait phase')
    ap.add_argument("--decimate", type=float, default=1.0, help="keep this fraction of faces")
    ap.add_argument("--flat", action="store_true", help="drop the hierarchy: one body mesh")
    ap.add_argument("--only", default=None, help="keep only meshes whose name contains this")
    ap.add_argument("--recolour", default="",
        help='"Material=#rrggbb[:emissive],..." base colours for materials that lost their textures')
    ap.add_argument("--out", action="append", default=None)
    args = ap.parse_args()
    outs = args.out or ["assets/models", "godot/assets/models"]

    clear_scene()
    load(args.src)
    if args.only:
        # A pack that ships several figures in a row: keep the one asked for.
        for o in mesh_objects():
            if args.only.lower() not in o.name.lower():
                bpy.data.objects.remove(o, do_unlink=True)
    meshes = mesh_objects()
    if not meshes:
        sys.exit("no meshes found")
    log(f"loaded {len(meshes)} meshes, {sum(len(m.data.polygons) for m in meshes)} polygons")

    # Anything that came in with an armature is baked as a static pose: the
    # game animates parts, not bones. Applying the modifiers keeps the pose.
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        for mod in list(o.modifiers):
            if mod.type == "ARMATURE":
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except RuntimeError as e:
                    log("could not apply", mod.name, e)
        o.select_set(False)
    for o in [o for o in bpy.data.objects if o.type == "ARMATURE"]:
        # Reparent the mesh to the world so the armature can go.
        for c in list(o.children):
            m = c.matrix_world.copy()
            c.parent = None
            c.matrix_world = m
        bpy.data.objects.remove(o, do_unlink=True)

    if args.decimate < 1.0:
        for o in meshes:
            mod = o.modifiers.new("decimate", "DECIMATE")
            mod.ratio = args.decimate
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)
        log(f"decimated to {sum(len(m.data.polygons) for m in meshes)} polygons")

    # Find the roots: objects with no parent. Wrap them in one root empty so
    # the whole thing can be turned, scaled and grounded as a unit.
    roots = [o for o in bpy.data.objects if o.parent is None]
    root = bpy.data.objects.new("body", None)
    bpy.context.scene.collection.objects.link(root)
    for o in roots:
        m = o.matrix_world.copy()
        o.parent = root
        o.matrix_world = m

    # Orientation and scale. Blender is Z up; the glTF exporter turns that
    # into Y up. Facing +X in Blender is facing +X in the game.
    lo, hi = world_bounds(meshes)
    height = hi.z - lo.z
    scale = args.height / max(height, 1e-6)
    root.matrix_world = (
        Matrix.Scale(scale, 4)
        @ Matrix.Rotation(math.radians(args.yaw), 4, "Z")
        @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
    )
    bpy.context.view_layer.update()

    # Bake the root's transform into the children so the exported root is
    # identity and every part's pivot is where it was drawn.
    for o in bpy.data.objects:
        o.select_set(o is not root)
    bpy.context.view_layer.objects.active = meshes[0]
    for c in list(root.children):
        m = c.matrix_world.copy()
        c.parent = None
        c.matrix_world = m
    bpy.data.objects.remove(root, do_unlink=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    lo, hi = world_bounds(meshes)
    log(f"bounds x {lo.x:.1f}..{hi.x:.1f}  y {lo.y:.1f}..{hi.y:.1f}  z {lo.z:.1f}..{hi.z:.1f}")

    # Name the parts the view looks for.
    if args.turret:
        t = find_node(args.turret)
        if t is None:
            log("WARNING: no node matches --turret", args.turret)
        else:
            t.name = "turret"
            log("turret:", t.name, "pivot", tuple(round(v, 2) for v in t.matrix_world.translation))
    if args.legs:
        for i, spec in enumerate(args.legs.split(",")):
            name, _, phase = spec.strip().partition(":")
            n = find_node(name)
            if n is None:
                log("WARNING: no node matches leg", name)
                continue
            n.name = f"leg_{i}_{phase or 'a'}"
            log("leg:", n.name, "pivot", tuple(round(v, 2) for v in n.matrix_world.translation))

    if args.flat:
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        bpy.context.view_layer.objects.active.name = "body"

    # A model whose textures did not come with it exports as bare white. Give
    # its materials flat colours instead, so it at least reads as a thing.
    if args.recolour:
        for spec in args.recolour.split(","):
            name, _, rest = spec.strip().partition("=")
            hexcol, _, flag = rest.partition(":")
            rgb = tuple(int(hexcol.lstrip("#")[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
            # sRGB to linear, which is what the node sockets expect.
            lin = tuple(((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in rgb)
            for mat in bpy.data.materials:
                if name.lower() not in mat.name.lower():
                    continue
                # Rebuilt from nothing rather than edited: the trees these
                # arrive with route through reroutes and frames the glTF
                # exporter does not follow, and it quietly writes a default
                # white material instead.
                mat.use_nodes = True
                tree = mat.node_tree
                tree.nodes.clear()
                out = tree.nodes.new("ShaderNodeOutputMaterial")
                bsdf = tree.nodes.new("ShaderNodeBsdfPrincipled")
                tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
                bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
                bsdf.inputs["Metallic"].default_value = 0.35
                bsdf.inputs["Roughness"].default_value = 0.55
                if flag == "emissive":
                    bsdf.inputs["Emission Color"].default_value = (*lin, 1.0)
                    bsdf.inputs["Emission Strength"].default_value = 2.0
                log("recoloured", mat.name, hexcol, flag)

    # Pack textures so the .glb is self-contained.
    for img in bpy.data.images:
        if img.packed_file is None and img.filepath:
            try:
                img.pack()
            except RuntimeError as e:
                log("could not pack", img.name, e)

    for out in outs:
        os.makedirs(out, exist_ok=True)
        path = os.path.join(out, args.id + ".glb")
        bpy.ops.export_scene.gltf(
            filepath=path, export_format="GLB", export_apply=True,
            export_yup=True, export_texcoords=True, export_normals=True,
            export_materials="EXPORT", export_image_format="AUTO",
            export_animations=False, export_skins=False, export_morph=False,
        )
        log("wrote", path, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
