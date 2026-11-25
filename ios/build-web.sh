#!/bin/bash
# Puts the piano teacher inside the iPad app.
#
# The teacher is a web app. This builds it as plain files and copies them to
# ios/MiddleC/web, which Xcode then packs into the app. Run it once before
# the first build, and again whenever the web app has changed.
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

echo "Writing the licence notices..."
# Every open source package the app's code pulls in is credited, with its licence text.
node scripts/piano-notices.mjs

echo "Building the web app..."
rm -rf out-app
MC_APP=1 npx next build

dest=ios/MiddleC/web
rm -rf "$dest"
mkdir -p "$dest/piano"
cp out-app/piano.html "$dest/"
[ -f out-app/piano.txt ] && cp out-app/piano.txt "$dest/"
cp -R out-app/_next "$dest/_next"
# The build also writes the code of this site's other pages. The piano teacher never loads it,
# so it does not go into the app: nothing ships that is not the app's own.
rm -f "$dest"/_next/static/chunks/app/page-*.js
rm -rf "$dest"/_next/static/chunks/app/_not-found
cp -R out-app/piano/samples out-app/piano/icons "$dest/piano/"
cp out-app/piano/capture-worklet.js out-app/piano/manifest.webmanifest out-app/piano/licences.txt "$dest/piano/"
rm -rf out-app

echo "Done. The web app is in $dest ($(du -sh "$dest" | cut -f1)). Now build the app in Xcode."
