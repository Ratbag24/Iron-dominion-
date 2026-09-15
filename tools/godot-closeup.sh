#!/usr/bin/env bash
# Render a few models large, for judging their detail.
#
#   GODOT=/path/to/godot tools/godot-closeup.sh out.png rifle,heavy,siege
set -uo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/godot-bin.sh"
OUT="${1:?usage: godot-closeup.sh <out.png> <id,id,...>}"
IDS="${2:?usage: godot-closeup.sh <out.png> <id,id,...>}"
FACING="${3:-}"   # optional heading in radians; 0 shows the +X face
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Re-import before rendering. Godot caches imported meshes, and a .glb that has
# been re-exported since the last import is silently ignored -- which looks
# exactly like a model change that did not work, and cost an hour of chasing
# one that had.
"$GODOT" --headless --path godot --import >/dev/null 2>&1
RUN=("$GODOT" --path godot --rendering-driver opengl3 --display-driver x11
     --resolution 1600x900 scenes/main.tscn -- "--closeup=$IDS" "--shot=$OUT" ${FACING:+"--facing=$FACING"})
if [ -n "${DISPLAY:-}" ]; then
  "${RUN[@]}"
else
  xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe "${RUN[@]}"
fi
