#!/bin/bash
# Empaqueta el Lambda Layer "deps" (deps compartidas de todas las lambdas).
set -e
LAYER_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$LAYER_DIR/../../dist"
mkdir -p "$DIST_DIR"
cd "$LAYER_DIR/nodejs" && npm install --omit=dev
cd "$LAYER_DIR"
rm -f "$DIST_DIR/Zafira-layer-deps.zip"
zip -q -r "$DIST_DIR/Zafira-layer-deps.zip" nodejs/ \
  -x "nodejs/package-lock.json" -x "nodejs/.DS_Store" -x "nodejs/node_modules/.bin/*" -x "*.md"
echo "✅ Layer deps: $DIST_DIR/Zafira-layer-deps.zip ($(du -h "$DIST_DIR/Zafira-layer-deps.zip" | cut -f1))"
