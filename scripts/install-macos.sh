#!/bin/bash
set -euo pipefail

enable_debug=0
if [ "${1:-}" = "--enable-debug-mode" ] && [ "$#" -eq 1 ]; then
  enable_debug=1
elif [ "$#" -ne 0 ]; then
  printf '%s\n' "Usage: bash scripts/install-macos.sh [--enable-debug-mode]" >&2
  exit 1
fi
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
project_root="$(cd "$script_dir/.." && pwd -P)"
source_dir="$project_root/extension"
if [ ! -f "$source_dir/CSXS/manifest.xml" ]; then
  printf '%s\n' "Extension manifest not found. Extract the complete archive first." >&2
  exit 1
fi
parent="$HOME/Library/Application Support/Adobe/CEP/extensions"
target="$parent/com.aeaistudio.panel"
mkdir -p "$parent"
parent="$(cd "$parent" && pwd -P)"
target="$parent/com.aeaistudio.panel"
if [ "$(dirname "$target")" != "$parent" ] || [ "$(basename "$target")" != "com.aeaistudio.panel" ]; then
  printf '%s\n' "Unexpected installation path." >&2
  exit 1
fi
case "$source_dir/" in
  "$target/"*) printf '%s\n' "Run the installer outside the installed extension directory." >&2; exit 1 ;;
esac
if [ -L "$target" ]; then
  printf '%s\n' "The installation target cannot be a link." >&2
  exit 1
fi
if [ -e "$target" ]; then
  backup_root="$(dirname "$parent")/ae-ai-studio-backups"
  mkdir -p "$backup_root"
  backup_root="$(cd "$backup_root" && pwd -P)"
  if [ "$(dirname "$backup_root")" != "$(dirname "$parent")" ]; then
    printf '%s\n' "Unexpected backup directory." >&2
    exit 1
  fi
  backup="$backup_root/com.aeaistudio.panel.backup-$(date +%Y%m%d-%H%M%S)-$$"
  if [ -e "$backup" ]; then
    printf '%s\n' "Backup path already exists." >&2
    exit 1
  fi
  mv "$target" "$backup"
  printf '%s\n' "Previous installation preserved: $backup"
fi
cp -R "$source_dir" "$target"
if [ "$enable_debug" -eq 1 ]; then
  defaults write com.adobe.CSXS.11 PlayerDebugMode 1
  defaults write com.adobe.CSXS.12 PlayerDebugMode 1
  printf '%s\n' "CEP debug mode enabled for this user (CSXS.11 and CSXS.12). This also permits other unsigned CEP extensions."
else
  printf '%s\n' "This unsigned beta needs CEP debug mode. Rerun with --enable-debug-mode to opt in."
fi
printf '%s\n' "Installed: $target" "Restart After Effects, then open Window > Extensions > AE AI Studio."
