#!/bin/bash

###############################################################################
# package-all-lambdas.sh - Empaqueta TODAS las Lambdas del proyecto
###############################################################################

set -e

echo "📦 Empaquetando TODAS las Lambdas de Zafira"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Directorio base
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LAMBDAS_DIR="$BASE_DIR/lambdas"
DIST_DIR="$BASE_DIR/lambdas/dist"
PREFIX="Zafira"

echo -e "${BLUE}📁 Directorio base: $BASE_DIR${NC}"

# Crear directorio dist si no existe
mkdir -p "$DIST_DIR"

# Encontrar todas las carpetas con index.js
LAMBDA_PATHS=$(find "$LAMBDAS_DIR" -name "index.js" -type f -not -path "*/node_modules/*" -not -path "*/layers/*" | xargs -I {} dirname {})

# Contador
count=0
total=$(echo "$LAMBDA_PATHS" | wc -l | tr -d ' ')

echo -e "\n${YELLOW}Empaquetando $total Lambdas...${NC}\n"

for lambda_path in $LAMBDA_PATHS; do
  count=$((count + 1))
  
  # Obtener nombre de la lambda (último directorio)
  lambda_name=$(basename "$lambda_path")
  zip_name="$PREFIX-$lambda_name.zip"
  
  echo -e "${BLUE}[$count/$total] Empaquetando $lambda_name...${NC}"
  
  # Ir al directorio de la Lambda
  cd "$lambda_path"
  
  # Limpiar ZIP anterior si existe
  if [ -f "$DIST_DIR/$zip_name" ]; then
    rm "$DIST_DIR/$zip_name"
  fi
  
  # Crear ZIP
  zip -q -r "$DIST_DIR/$zip_name" . \
    -x "*.git*" \
    -x "*.DS_Store" \
    -x "node_modules/.bin/*" \
    -x "package-lock.json" \
    -x "*.md"
  
  # Verificar tamaño
  size=$(du -h "$DIST_DIR/$zip_name" | cut -f1)
  echo -e "${GREEN}  ✓ $zip_name ($size)${NC}"
done

echo -e "\n${GREEN}✅ Empaquetado completo!${NC}"
echo -e "${GREEN}📁 Archivos en: $DIST_DIR${NC}\n"

# Listar archivos generados
echo -e "${BLUE}Archivos generados ($total Lambdas + 1 Layer):${NC}"
ls -lh "$DIST_DIR" | grep "^-" | awk '{print "  " $9 " (" $5 ")"}'

echo -e "\n${YELLOW}Siguiente paso:${NC}"
echo -e "  cd terraform"
echo -e "  terraform plan"
echo -e "  terraform apply"
