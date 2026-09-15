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
    ap.add_argument("--pose", default="",
        help='"bone=x,y,z;bone=..." pose-bone rotations in degrees, applied before baking')
    ap.add_argument("--legs-from-bones", default="",
        help='"thigh.L:a,thigh.R:b" split a rigged mesh into leg nodes by bone weight')
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

    armature = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)

    # A rigged model arrives in whatever pose it was saved in - usually a
    # T-pose. --pose turns named bones before anything is baked.
    if args.pose and armature is not None:
        for spec in args.pose.split(";"):
            bone, _, angles = spec.strip().partition("=")
            pb = armature.pose.bones.get(bone)
            if pb is None:
                log("WARNING: no bone", bone)
                continue
            x, y, z = (math.radians(float(v)) for v in angles.split(","))
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = (x, y, z)
        bpy.context.view_layer.update()

    # Legs cut out of a rigged mesh: every vertex whose heaviest weight is on
    # the named bone or one of its children goes into its own object, pivoted
    # at the bone's head. That is what the view needs to swing it, and it is
    # how a humanoid rig becomes the same two-node walker as a procedural bot.
    leg_specs = []
    if args.legs_from_bones and armature is not None:
        for i, spec in enumerate(args.legs_from_bones.split(",")):
            bone, _, phase = spec.strip().partition(":")
            root_bone = armature.data.bones.get(bone)
            if root_bone is None:
                log("WARNING: no bone", bone)
                continue
            family = {root_bone.name}
            stack = list(root_bone.children)
            while stack:
                b = stack.pop()
                family.add(b.name)
                stack.extend(b.children)
            head = armature.matrix_world @ root_bone.head_local
            leg_specs.append((f"leg_{i}_{phase or 'a'}", family, head))

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

    for name, family, head in leg_specs:
        src = meshes[0]
        idx = {g.index: g.name for g in src.vertex_groups}
        bpy.ops.object.select_all(action="DESELECT")
        src.select_set(True)
        bpy.context.view_layer.objects.active = src
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.object.mode_set(mode="OBJECT")
        picked = 0
        for v in src.data.vertices:
            best = max(v.groups, key=lambda g: g.weight, default=None)
            v.select = best is not None and idx.get(best.group) in family
            picked += 1 if v.select else 0
        if picked == 0:
            log("WARNING: no vertices weighted to", name)
            continue
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_mode(type="VERT")
        bpy.ops.mesh.separate(type="SELECTED")
        bpy.ops.object.mode_set(mode="OBJECT")
        leg = [o for o in mesh_objects() if o is not src and o.name not in [s[0] for s in leg_specs]][-1]
        leg.name = name
        # Pivot at the bone head, parented to the body so it moves with it.
        bpy.context.scene.cursor.location = head
        bpy.ops.object.select_all(action="DESELECT")
        leg.select_set(True)
        bpy.context.view_layer.objects.active = leg
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
        m = leg.matrix_world.copy()
        leg.parent = src
        leg.matrix_world = m
        log("leg", name, "from", picked, "vertices, pivot", tuple(round(v, 2) for v in head))
    meshes = mesh_objects()

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
        # Everything that is not a named part joins into the largest mesh,
        # which becomes the body. The join target has to be chosen, not
        # taken as "the first object": after a leg split that was a leg,
        # and the body vanished into it.
        parts = [o for o in meshes if o.name.startswith("leg_") or o.name == "turret"]
        rest = [o for o in meshes if o not in parts]
        body = max(rest, key=lambda o: len(o.data.vertices))
        bpy.ops.object.select_all(action="DESELECT")
        for o in rest:
            o.select_set(True)
        bpy.context.view_layer.objects.active = body
        if len(rest) > 1:
            bpy.ops.object.join()
        body.name = "body"
        for o in parts:
            if o.parent is not body:
                m = o.matrix_world.copy()
                o.parent = body
                o.matrix_world = m

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
