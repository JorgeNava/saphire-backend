#!/bin/bash

###############################################################################
# build.sh - Script para empaquetar el Lambda Layer DriveService
###############################################################################

set -e

echo "🔧 Empaquetando Lambda Layer: DriveService"

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorio actual
LAYER_DIR="$(cd "$(dirname "$0")" && pwd)"
NODEJS_DIR="$LAYER_DIR/nodejs"
DIST_DIR="$LAYER_DIR/../../dist"
ZIP_NAME="Zafira-layer-driveService.zip"

echo -e "${BLUE}📁 Directorio del layer: $LAYER_DIR${NC}"

# Crear directorio dist si no existe
mkdir -p "$DIST_DIR"

# Instalar dependencias si no existen
if [ ! -d "$NODEJS_DIR/node_modules" ]; then
  echo -e "${BLUE}📦 Instalando dependencias...${NC}"
  cd "$NODEJS_DIR"
  npm install --production
  cd "$LAYER_DIR"
else
  echo -e "${GREEN}✓ Dependencias ya instaladas${NC}"
fi

# Limpiar ZIP anterior si existe
if [ -f "$DIST_DIR/$ZIP_NAME" ]; then
  echo -e "${BLUE}🗑️  Eliminando ZIP anterior...${NC}"
  rm "$DIST_DIR/$ZIP_NAME"
fi

# Crear ZIP
echo -e "${BLUE}📦 Creando archivo ZIP...${NC}"
cd "$LAYER_DIR"
zip -r "$DIST_DIR/$ZIP_NAME" nodejs/ \
  -x "nodejs/package-lock.json" \
  -x "nodejs/.DS_Store" \
  -x "nodejs/node_modules/.bin/*" \
  -x "*.md"

# Verificar tamaño
SIZE=$(du -h "$DIST_DIR/$ZIP_NAME" | cut -f1)
echo -e "${GREEN}✓ Layer empaquetado exitosamente${NC}"
echo -e "${GREEN}  Archivo: $DIST_DIR/$ZIP_NAME${NC}"
echo -e "${GREEN}  Tamaño: $SIZE${NC}"

# Mostrar contenido del ZIP
echo -e "\n${BLUE}📋 Contenido del ZIP:${NC}"
unzip -l "$DIST_DIR/$ZIP_NAME" | head -20

echo -e "\n${GREEN}✅ Listo para deploy con Terraform${NC}"
