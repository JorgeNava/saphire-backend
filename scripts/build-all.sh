#!/bin/bash

###############################################################################
# build-all.sh - Empaqueta Lambda Layer y todas las Lambdas modificadas
###############################################################################

set -e

echo "🚀 Build completo de Zafira Backend"
echo "===================================="

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Directorio base
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "\n${BLUE}Paso 1: Empaquetando Lambda Layer (TagService)${NC}"
echo "------------------------------------------------"
cd "$BASE_DIR/lambdas/layers/tagService"
./build.sh

echo -e "\n${BLUE}Paso 2: Empaquetando Lambdas modificadas${NC}"
echo "------------------------------------------------"
cd "$BASE_DIR"
./scripts/package-lambdas.sh

echo -e "\n${GREEN}✅ Build completo exitoso!${NC}"
echo -e "\n${YELLOW}Archivos generados en: lambdas/dist/${NC}"
ls -lh "$BASE_DIR/lambdas/dist" | grep "^-" | awk '{print "  " $9 " (" $5 ")"}'

echo -e "\n${YELLOW}Siguiente paso para deploy:${NC}"
echo -e "  cd terraform"
echo -e "  terraform plan"
echo -e "  terraform apply"
