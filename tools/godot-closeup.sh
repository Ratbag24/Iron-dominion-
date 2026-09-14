#!/usr/bin/env bash
# Render a few models large, for judging their detail.
#
#   GODOT=/path/to/godot tools/godot-closeup.sh out.png rifle,heavy,siege
set -uo pipefail
GODOT="${GODOT:-godot}"
OUT="${1:?usage: godot-closeup.sh <out.png> <id,id,...>}"
IDS="${2:?usage: godot-closeup.sh <out.png> <id,id,...>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUN=("$GODOT" --path godot --rendering-driver opengl3 --display-driver x11
     --resolution 1600x900 scenes/main.tscn -- "--closeup=$IDS" "--shot=$OUT")
if [ -n "${DISPLAY:-}" ]; then
  "${RUN[@]}"
else
  xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe "${RUN[@]}"
fi
