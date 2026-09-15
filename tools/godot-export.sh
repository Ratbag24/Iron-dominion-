#!/usr/bin/env bash
# Export the game.
#
#   GODOT=/path/to/godot tools/godot-export.sh [linux|windows|macos|web|all]
#
# Needs the matching export templates installed for the engine's version:
#   https://godotengine.org/download  ->  "Export templates"
# or fetch the .tpz and unzip it to
#   ~/.local/share/godot/export_templates/<version>/
#
# Output goes to build/<target>/, which is not tracked.
set -uo pipefail

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/godot-bin.sh"
TARGET="${1:-all}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"


export_one() {
  local preset="$1" dir="$2"
  echo "=== $preset ==="
  mkdir -p "build/$dir"
  if ! "$GODOT" --headless --path godot --export-release "$preset" 2>&1 \
      | grep -viE "^savepack|Storing File"; then
    echo "  export failed"
    return 1
  fi
  ls -lh "build/$dir"
}

status=0
case "$TARGET" in
  linux)   export_one Linux linux || status=1 ;;
  windows) export_one Windows windows || status=1 ;;
  macos)   export_one macOS macos || status=1 ;;
  web)     export_one Web web || status=1 ;;
  all)
    export_one Linux linux || status=1
    export_one Windows windows || status=1
    export_one macOS macos || status=1
    export_one Web web || status=1
    ;;
  *)
    echo "unknown target: $TARGET (linux, windows, macos, web, all)"
    exit 2
    ;;
esac
exit $status
