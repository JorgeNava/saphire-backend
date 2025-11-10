#!/bin/bash

###############################################################################
# Script para empaquetar los nuevos lambdas y los modificados
# Uso: ./scripts/package-new-lambdas.sh
###############################################################################

set -e  # Exit on error

echo "🚀 Empaquetando lambdas nuevos y modificados..."
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${BASE_DIR}/dist"
LAMBDAS_DIR="${BASE_DIR}/lambdas"

# Crear directorio dist si no existe
mkdir -p "${DIST_DIR}"

echo -e "${BLUE}📦 Directorio de salida: ${DIST_DIR}${NC}"
echo ""

###############################################################################
# Función para empaquetar un lambda
###############################################################################
package_lambda() {
    local category=$1
    local lambda_name=$2
    local zip_name=$3
    
    echo -e "${BLUE}Empaquetando ${lambda_name}...${NC}"
    
    cd "${LAMBDAS_DIR}/${category}/${lambda_name}"
    
    # Instalar dependencias si existe package.json
    if [ -f "package.json" ]; then
        echo "  - Instalando dependencias..."
        npm install --production --silent
    fi
    
    # Crear ZIP desde dentro del directorio del lambda (sin incluir la carpeta padre)
    echo "  - Creando archivo ZIP..."
    zip -r "${DIST_DIR}/${zip_name}.zip" . -q -x "*.git*" -x "*.DS_Store"
    
    echo -e "${GREEN}  ✅ ${zip_name}.zip creado${NC}"
    echo ""
}

###############################################################################
# Empaquetar nuevos lambdas
###############################################################################
echo "📦 NUEVOS LAMBDAS"
echo "================="
echo ""

package_lambda "notes" "addThoughtToNote" "saphire-addThoughtToNote"
package_lambda "lists" "refreshListFromTags" "saphire-refreshListFromTags"

###############################################################################
# Empaquetar lambdas modificados
###############################################################################
echo "📦 LAMBDAS MODIFICADOS"
echo "======================"
echo ""

package_lambda "tags" "createTag" "saphire-createTag"
package_lambda "tags" "updateTag" "saphire-updateTag"

###############################################################################
# Resumen
###############################################################################
echo ""
echo -e "${GREEN}✅ Empaquetado completado${NC}"
echo ""
echo "Archivos creados en ${DIST_DIR}:"
ls -lh "${DIST_DIR}"/saphire-addThoughtToNote.zip 2>/dev/null || echo "  ⚠️  saphire-addThoughtToNote.zip no encontrado"
ls -lh "${DIST_DIR}"/saphire-refreshListFromTags.zip 2>/dev/null || echo "  ⚠️  saphire-refreshListFromTags.zip no encontrado"
ls -lh "${DIST_DIR}"/saphire-createTag.zip 2>/dev/null || echo "  ⚠️  saphire-createTag.zip no encontrado"
ls -lh "${DIST_DIR}"/saphire-updateTag.zip 2>/dev/null || echo "  ⚠️  saphire-updateTag.zip no encontrado"
echo ""
echo "Próximo paso: cd terraform && terraform plan -out=tfplan"
