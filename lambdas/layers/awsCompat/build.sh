#!/bin/bash

###############################################################################
# build.sh - Empaqueta el Lambda Layer awsCompat (adaptador aws-sdk v2->v3)
###############################################################################

set -e

echo "🔧 Empaquetando Lambda Layer: awsCompat"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

LAYER_DIR="$(cd "$(dirname "$0")" && pwd)"
NODEJS_DIR="$LAYER_DIR/nodejs"
DIST_DIR="$LAYER_DIR/../../dist"
ZIP_NAME="Zafira-layer-awsCompat.zip"

echo -e "${BLUE}📁 Directorio del layer: $LAYER_DIR${NC}"
mkdir -p "$DIST_DIR"

echo -e "${BLUE}📦 Instalando dependencias (subset @aws-sdk v3)...${NC}"
cd "$NODEJS_DIR"
npm install --production
cd "$LAYER_DIR"

if [ -f "$DIST_DIR/$ZIP_NAME" ]; then
  rm "$DIST_DIR/$ZIP_NAME"
fi

echo -e "${BLUE}📦 Creando archivo ZIP...${NC}"
cd "$LAYER_DIR"
zip -rq "$DIST_DIR/$ZIP_NAME" nodejs/ \
  -x "nodejs/package-lock.json" \
  -x "nodejs/.DS_Store" \
  -x "nodejs/node_modules/.bin/*" \
  -x "*.md"

SIZE=$(du -h "$DIST_DIR/$ZIP_NAME" | cut -f1)
echo -e "${GREEN}✓ Layer empaquetado: $DIST_DIR/$ZIP_NAME ($SIZE)${NC}"
