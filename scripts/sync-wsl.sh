#!/usr/bin/env bash
set -euo pipefail
source_dir=/mnt/d/Work/Projects/three.js_test
target_dir="$HOME/projects/three.js_test"
mkdir -p "$target_dir"
# Source delivery stays in the desktop workspace. Builds/dependencies live on ext4.
# rsync installs changed files by rename so Vite never reads a half-written module.
rsync -a --exclude=.git --exclude=node_modules --exclude=dist --exclude=test-results --exclude=playwright-report "$source_dir/" "$target_dir/"
export PATH="$HOME/.local/node/bin:$PATH"
cd "$target_dir"
if [ "${1:-}" = install ]; then
  npm install
  cp package-lock.json "$source_dir/package-lock.json"
fi
if [ "${1:-}" = build ]; then npm run build; fi
if [ "${1:-}" = dev ]; then exec npm run dev -- --host 0.0.0.0; fi
