#!/bin/bash
# Puts the guitar teacher inside the iPad app.
#
# The teacher is a web app. This builds it as plain files and copies them to
# ios-guitar/OpenString/web, which Xcode then packs into the app. Run it once
# before the first build, and again whenever the web app has changed.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is needed to build the web app. Install it from https://nodejs.org (the LTS version), then run this again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing what the web app is built with (first time only)..."
  npm ci
fi

echo "Building the web app..."
rm -rf out-app
MC_APP=1 npx next build

dest=ios-guitar/OpenString/web
rm -rf "$dest"
mkdir -p "$dest/guitar"
cp out-app/guitar.html "$dest/"
[ -f out-app/guitar.txt ] && cp out-app/guitar.txt "$dest/"
cp -R out-app/_next "$dest/_next"
cp -R out-app/guitar/icons "$dest/guitar/"
cp out-app/guitar/capture-worklet.js out-app/guitar/manifest.webmanifest "$dest/guitar/"
rm -rf out-app

echo "Done. The web app is in $dest ($(du -sh "$dest" | cut -f1)). Now build the app in Xcode."
