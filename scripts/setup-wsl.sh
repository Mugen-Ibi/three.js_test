#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$HOME/.local/node" "$HOME/projects"
if [ ! -x "$HOME/.local/node/bin/node" ]; then
  download_dir=$(mktemp -d)
  cd "$download_dir"
  curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o SHASUMS256.txt
  node_archive=$(awk '/linux-x64.tar.xz$/ {print $2}' SHASUMS256.txt)
  curl -fsSL "https://nodejs.org/dist/latest-v24.x/$node_archive" -o "$node_archive"
  grep "$node_archive" SHASUMS256.txt | sha256sum -c -
  tar -xJf "$node_archive" -C "$HOME/.local/node" --strip-components=1
fi
export PATH="$HOME/.local/node/bin:$PATH"
node --version
if [ ! -d "$HOME/projects/three.js_test" ]; then
  git clone /mnt/d/Work/Projects/three.js_test "$HOME/projects/three.js_test"
fi
