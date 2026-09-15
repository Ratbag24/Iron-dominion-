#!/usr/bin/env bash
# Run the Godot test suites headlessly.
#
#   GODOT=/path/to/godot tools/godot-test.sh
#
# Falls back to a binary on PATH, or one fetched into the cache. Assets are imported first, which also builds
# the global class cache that `--script` needs to resolve class_name types.
set -uo pipefail

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/godot-bin.sh"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Importing assets"
"$GODOT" --headless --path godot --import >/dev/null 2>&1

status=0
for test in verify_assets parity_rng parity_map test_pathfinder test_defs test_world test_commands test_audio test_view test_quarters test_blight test_air test_infantry test_creep; do
  script="scripts/tests/$test.gd"
  [ "$test" = "verify_assets" ] && script="scripts/verify_assets.gd"
  echo
  echo "=== $test ==="
  if ! "$GODOT" --headless --path godot --script "$script" 2>&1 | grep -v "^Godot Engine v"; then
    status=1
  fi
done
exit $status
