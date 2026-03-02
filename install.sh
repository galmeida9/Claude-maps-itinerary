#!/usr/bin/env bash
# install.sh — symlinks the maps-itinerary skill into ~/.claude/skills/
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
TARGET="$SKILLS_DIR/maps-itinerary"

mkdir -p "$SKILLS_DIR"

if [ -L "$TARGET" ]; then
  echo "Removing existing symlink at $TARGET"
  rm "$TARGET"
elif [ -e "$TARGET" ]; then
  echo "Error: $TARGET exists and is not a symlink. Remove it manually first."
  exit 1
fi

ln -s "$SKILL_DIR" "$TARGET"

echo "✓ Skill installed: $TARGET -> $SKILL_DIR"
echo "  Reload Claude Code for the skill to take effect."
