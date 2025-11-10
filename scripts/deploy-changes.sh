#!/bin/bash

###############################################################################
# Script completo de deployment para las nuevas funcionalidades
# Uso: ./scripts/deploy-changes.sh
###############################################################################

set -e  # Exit on error

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     🚀 DEPLOYMENT - SAPHIRE BACKEND                       ║"
echo "║        Nuevas Funcionalidades                             ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

###############################################################################
# Paso 1: Verificar que estamos en el directorio correcto
###############################################################################
if [ ! -f "${BASE_DIR}/package.json" ]; then
    echo -e "${RED}❌ Error: No se encontró package.json${NC}"
    echo "   Asegúrate de ejecutar este script desde el directorio raíz del proyecto"
    exit 1
fi

echo -e "${BLUE}📍 Directorio del proyecto: ${BASE_DIR}${NC}"
echo ""

###############################################################################
# Paso 2: Confirmar deployment
###############################################################################
echo -e "${YELLOW}⚠️  Este script va a:${NC}"
echo "   1. Empaquetar 4 lambdas (2 nuevos, 2 modificados)"
echo "   2. Ejecutar terraform plan"
echo "   3. Solicitar confirmación para aplicar cambios"
echo ""
read -p "¿Deseas continuar? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelado${NC}"
    exit 0
fi

echo ""

###############################################################################
# Paso 3: Empaquetar lambdas
###############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PASO 1: Empaquetando Lambdas${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

"${BASE_DIR}/scripts/package-new-lambdas.sh"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error al empaquetar lambdas${NC}"
    exit 1
fi

###############################################################################
# Paso 4: Terraform Plan
###############################################################################
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PASO 2: Terraform Plan${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

cd "${BASE_DIR}/terraform"

echo -e "${BLUE}Ejecutando terraform plan...${NC}"
terraform plan -out=tfplan

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error en terraform plan${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Terraform plan completado${NC}"
echo ""

###############################################################################
# Paso 5: Confirmar Apply
###############################################################################
echo -e "${YELLOW}⚠️  Revisa los cambios arriba.${NC}"
echo ""
read -p "¿Deseas aplicar estos cambios a AWS? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelado. El plan se guardó en terraform/tfplan${NC}"
    exit 0
fi

echo ""

###############################################################################
# Paso 6: Terraform Apply
###############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PASO 3: Terraform Apply${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

terraform apply tfplan

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error en terraform apply${NC}"
    exit 1
fi

###############################################################################
# Paso 7: Obtener URL del API
###############################################################################
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}PASO 4: Información del Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "No disponible")

echo -e "${GREEN}✅ Deployment completado exitosamente${NC}"
echo ""
echo "📝 Información del API:"
echo "   URL: ${API_URL}"
echo ""
echo "🔗 Nuevos endpoints disponibles:"
echo "   POST ${API_URL}/notes/{noteId}/add-thought"
echo "   POST ${API_URL}/lists/{listId}/refresh-from-tags"
echo ""
echo "🔧 Endpoints modificados:"
echo "   POST ${API_URL}/tags (validación de nombres únicos)"
echo "   PUT  ${API_URL}/tags/{tagId} (validación de nombres únicos)"
echo ""

###############################################################################
# Paso 8: Sugerencias de testing
###############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Próximos pasos recomendados:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Probar los nuevos endpoints con Postman o curl"
echo "2. Verificar que los endpoints existentes siguen funcionando"
echo "3. Actualizar el frontend para usar los nuevos endpoints"
echo "4. Revisar logs de CloudWatch si hay errores"
echo ""
echo "Para más información, consulta:"
echo "  - DEPLOYMENT_INSTRUCTIONS.md"
echo "  - MEJORAS_BACKEND_TRACKING.md"
echo "  - ANALISIS_FRONTEND.md"
echo ""
