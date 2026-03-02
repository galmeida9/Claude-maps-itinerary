#!/usr/bin/env bash
# uninstall.sh — removes the maps-itinerary symlink from ~/.claude/skills/
set -euo pipefail

TARGET="$HOME/.claude/skills/maps-itinerary"

if [ -L "$TARGET" ]; then
  rm "$TARGET"
  echo "✓ Skill removed: $TARGET"
  echo "  Reload Claude Code for the change to take effect."
elif [ -e "$TARGET" ]; then
  echo "Error: $TARGET exists but is not a symlink. Remove it manually."
  exit 1
else
  echo "Nothing to do: $TARGET does not exist."
fi
