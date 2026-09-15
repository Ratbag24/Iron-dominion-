#!/usr/bin/env bash
# Locate a Godot 4 binary, fetching one if the machine has none.
#
# Source this, do not run it:
#
#   . "$(dirname "$0")/godot-bin.sh"   # sets GODOT, or exits 127
#
# The search order is: an explicit $GODOT, then PATH, then the download cache.
# Only if all three come up empty do we go to the network. The cache lives
# under $HOME rather than /tmp so it survives a container that clears /tmp --
# losing the binary silently is what this script exists to prevent.

GODOT_VERSION="${GODOT_VERSION:-4.3-stable}"
GODOT_CACHE="${GODOT_CACHE:-$HOME/.cache/godot-bin}"

_godot_usable() {
  [ -n "${1:-}" ] && { command -v "$1" >/dev/null 2>&1 || [ -x "$1" ]; }
}

godot_resolve() {
  if _godot_usable "${GODOT:-}"; then return 0; fi
  if command -v godot >/dev/null 2>&1; then GODOT=godot; return 0; fi

  local exe="Godot_v${GODOT_VERSION}_linux.x86_64"
  local cached
  for cached in "$GODOT_CACHE/$exe" "/tmp/godot-bin/$exe"; do
    if [ -x "$cached" ]; then GODOT="$cached"; return 0; fi
  done

  echo "Godot $GODOT_VERSION not found; fetching it once into $GODOT_CACHE" >&2
  mkdir -p "$GODOT_CACHE" || return 1
  local url="https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/${exe}.zip"
  local zip="$GODOT_CACHE/$exe.zip"
  if ! curl -fsSL "$url" -o "$zip"; then
    echo "Could not download Godot. Set GODOT=/path/to/$exe" >&2
    return 1
  fi
  if ! unzip -oq "$zip" -d "$GODOT_CACHE"; then
    echo "Could not unpack $zip" >&2
    return 1
  fi
  rm -f "$zip"
  chmod +x "$GODOT_CACHE/$exe"
  GODOT="$GODOT_CACHE/$exe"
}

if ! godot_resolve; then
  echo "Godot 4 not found. Set GODOT=/path/to/Godot_v${GODOT_VERSION}_linux.x86_64" >&2
  exit 127
fi
export GODOT
