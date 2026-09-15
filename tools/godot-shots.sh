#!/usr/bin/env bash
# Capture the interface states worth looking at, headlessly.
#
#   GODOT=/path/to/godot tools/godot-shots.sh [outdir]
#
# Needs a display. Under xvfb with software GL this is slow but works, which
# is how it runs on a machine with no GPU.
set -uo pipefail

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/godot-bin.sh"
OUT="${1:-shots}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Re-import before rendering. Godot caches imported meshes, and a .glb that has
# been re-exported since the last import is silently ignored -- which looks
# exactly like a model change that did not work, and cost an hour of chasing
# one that had.
"$GODOT" --headless --path godot --import >/dev/null 2>&1
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

run() {
  local name="$1"; shift
  echo "=== $name ==="
  if [ -n "${DISPLAY:-}" ]; then
    "$GODOT" "$@"
  else
    xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe "$GODOT" "$@"
  fi
}

COMMON=(--path godot --rendering-driver opengl3 --display-driver x11 --resolution 1600x900)

run menu "${COMMON[@]}" --script scripts/tools/shot_menu.gd -- --out="$OUT/menu.png"
run match "${COMMON[@]}" -- --ticks=5400 --shot="$OUT/match.png"
run orders "${COMMON[@]}" --script scripts/tools/shot_orders.gd -- --play --out="$OUT/orders.png"
run battle "${COMMON[@]}" -- --ai --action --ticks=14000 --shot="$OUT/battle.png"

echo
echo "shots in $OUT"
