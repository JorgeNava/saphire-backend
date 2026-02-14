# 🚀 Deployment Guide - Saphire Backend v0.0.8

**Fecha:** 16 de noviembre de 2025  
**Versión:** 0.0.8  
**Issues Resueltos:** 3/3 ✅  
**Features Nuevas:** 2/2 ✅

---

## 📋 Pre-Deployment Checklist

### ✅ Cambios Implementados

- [x] Fix PUT /thoughts/{thoughtId} - Tags se actualizan correctamente
- [x] GET /lists - Parámetro searchTerm agregado
- [x] POST /notes/from-list - Nuevo endpoint implementado
- [x] Campo pinned en Lists y Notes
- [x] Ordenamiento automático por pinned
- [x] Documentación completa generada
- [x] CHANGELOG.md actualizado
- [x] README.md actualizado

### ⚠️ Archivos Pendientes de Package

```bash
# Nuevo lambda que necesita package
lambdas/notes/createNoteFromList/
```

### ⚠️ Terraform Pendiente

```bash
# Cambios en configuración
terraform/api_gateway.tf
terraform/lambdas.tf
```

---

## 🔧 Paso 1: Package del Nuevo Lambda

### Opción A: Script Automatizado

```bash
# Desde la raíz del proyecto
cd /Users/jorge.nava/Personal/Repos/saphire-backend

# Package el nuevo lambda
./scripts/package-lambda.sh createNoteFromList
```

### Opción B: Manual

```bash
# Navegar al directorio del lambda
cd lambdas/notes/createNoteFromList

# Instalar dependencias
npm install

# Volver a raíz
cd ../../..

# Crear ZIP
cd lambdas/notes/createNoteFromList
zip -r ../../../dist/Zafira-createNoteFromList.zip . -x "*.git*" "*.DS_Store"
cd ../../..
```

### Verificar Package

```bash
# Verificar que el ZIP existe
ls -lh dist/Zafira-createNoteFromList.zip

# Verificar contenido del ZIP (index.js debe estar en la raíz)
unzip -l dist/Zafira-createNoteFromList.zip | head -20
```

**Estructura esperada:**
```
  Length      Date    Time    Name
---------  ---------- -----   ----
     5000  11-16-2025 01:00   index.js
      150  11-16-2025 01:00   package.json
    xxxxx  xx-xx-xxxx xx:xx   node_modules/...
```

---

## 🌍 Paso 2: Package Lambdas Modificados

### Lambdas que necesitan re-package:

```bash
# Thoughts
./scripts/package-lambda.sh updateThought

# Lists
./scripts/package-lambda.sh getLists
./scripts/package-lambda.sh createList
./scripts/package-lambda.sh updateList

# Notes
./scripts/package-lambda.sh createNote
./scripts/package-lambda.sh updateNote
./scripts/package-lambda.sh getNotes
```

### Script Batch (recomendado)

```bash
#!/bin/bash
# package-all-v008.sh

LAMBDAS=(
  "updateThought"
  "getLists"
  "createList"
  "updateList"
  "createNote"
  "updateNote"
  "getNotes"
  "createNoteFromList"
)

for lambda in "${LAMBDAS[@]}"; do
  echo "📦 Packaging $lambda..."
  ./scripts/package-lambda.sh "$lambda"
  if [ $? -eq 0 ]; then
    echo "✅ $lambda packaged"
  else
    echo "❌ Error packaging $lambda"
    exit 1
  fi
done

echo "🎉 All lambdas packaged successfully!"
```

**Ejecutar:**
```bash
chmod +x package-all-v008.sh
./package-all-v008.sh
```

---

## 🏗️ Paso 3: Terraform Plan

### Verificar Cambios

```bash
cd terraform

# Inicializar (si es necesario)
terraform init

# Ver plan de cambios
terraform plan

# Guardar plan para review
terraform plan -out=tfplan-v008
```

### Cambios Esperados

**Recursos Nuevos:**
```hcl
+ aws_lambda_function.all["createNoteFromList"]
+ aws_apigatewayv2_route.routes["createNoteFromList"]
+ aws_apigatewayv2_integration.lambda["createNoteFromList"]
+ aws_lambda_permission.api_gateway["createNoteFromList"]
```

**Recursos Actualizados:**
```hcl
~ aws_lambda_function.all["updateThought"]
~ aws_lambda_function.all["getLists"]
~ aws_lambda_function.all["createList"]
~ aws_lambda_function.all["updateList"]
~ aws_lambda_function.all["createNote"]
~ aws_lambda_function.all["updateNote"]
~ aws_lambda_function.all["getNotes"]
```

### ⚠️ Revisar Plan

**Verificar que NO hay:**
- ❌ Recursos eliminados inesperados
- ❌ Cambios en configuración de API Gateway existente
- ❌ Cambios en variables de entorno no intencionales

---

## 🚀 Paso 4: Deploy con Terraform

### Deployment

```bash
# Aplicar cambios
terraform apply tfplan-v008

# O de forma interactiva
terraform apply
```

### Monitoreo durante Deploy

```bash
# En otra terminal, monitorear CloudWatch
aws logs tail /aws/lambda/Zafira-updateThought --follow

# Ver estado de lambdas
aws lambda list-functions --query 'Functions[?contains(FunctionName, `Zafira`)].FunctionName'
```

### Verificar Deploy Exitoso

```bash
# Verificar que todos los lambdas existen
aws lambda get-function --function-name Zafira-createNoteFromList
aws lambda get-function --function-name Zafira-updateThought

# Verificar última actualización
aws lambda get-function --function-name Zafira-updateThought \
  --query 'Configuration.LastModified'
```

---

## 🧪 Paso 5: Testing Post-Deploy

### Test 1: Fix Tags en Thoughts ✅

```bash
# Endpoint base
API_URL="https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com"

# Crear pensamiento con tags
THOUGHT_ID=$(curl -s -X POST "$API_URL/thoughts" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user-123",
    "content":"Pensamiento de prueba v0.0.8",
    "tags":["TestTag1","TestTag2"]
  }' | jq -r '.thoughtId')

echo "Created thought: $THOUGHT_ID"

# Actualizar tags (DEBE FUNCIONAR)
curl -X PUT "$API_URL/thoughts/$THOUGHT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user-123",
    "content":"Contenido actualizado",
    "tags":["TestTag3","TestTag4"]
  }'

# Verificar actualización
curl -s "$API_URL/thoughts/$THOUGHT_ID" | jq '.tagNames'
# Debe mostrar: ["TestTag3", "TestTag4"]
```

### Test 2: Búsqueda de Listas ✅

```bash
# Crear lista de prueba
curl -X POST "$API_URL/lists" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user-123",
    "name":"Compras del supermercado",
    "items":["Leche","Pan"]
  }'

# Buscar con searchTerm
curl -s "$API_URL/lists?userId=test-user-123&searchTerm=compras" | jq '.[].name'
# Debe encontrar la lista
```

### Test 3: Campo Pinned ✅

```bash
# Crear lista pinned
LIST_ID=$(curl -s -X POST "$API_URL/lists" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user-123",
    "name":"Lista Importante",
    "items":["Item 1"],
    "pinned":true
  }' | jq -r '.listId')

# Crear lista normal
curl -X POST "$API_URL/lists" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user-123",
    "name":"Lista Normal",
    "items":["Item A"]
  }'

# Obtener todas (pinned debe aparecer primero)
curl -s "$API_URL/lists?userId=test-user-123" | jq '[.[].name]'
# ["Lista Importante", "Lista Normal", ...]

# Actualizar pinned
curl -X PUT "$API_URL/lists/$LIST_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user-123",
    "pinned":false
  }'
```

### Test 4: Conversión Lista → Nota ✅

```bash
# Crear lista para convertir
LIST_ID=$(curl -s -X POST "$API_URL/lists" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user-123",
    "name":"Lista para Nota",
    "items":["Item 1","Item 2","Item 3"],
    "tags":["Testing"]
  }' | jq -r '.listId')

# Convertir a nota (preservar lista)
NOTE=$(curl -s -X POST "$API_URL/notes/from-list" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\":\"test-user-123\",
    \"listId\":\"$LIST_ID\",
    \"title\":\"Nota desde Lista\",
    \"preserveList\":true,
    \"formatAsBullets\":true
  }")

echo "$NOTE" | jq '{noteId, title, content, sourceType, listDeleted}'

# Verificar contenido con bullets
echo "$NOTE" | jq -r '.content'
# Debe mostrar:
# • Item 1
# • Item 2
# • Item 3

# Verificar que la lista sigue existiendo
curl -s "$API_URL/lists/$LIST_ID" | jq '.name'
```

### Test 5: Ordenamiento por Pinned ✅

```bash
# Crear múltiples notas (algunas pinned)
for i in {1..3}; do
  curl -s -X POST "$API_URL/notes" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\":\"test-user-123\",
      \"title\":\"Nota Pinned $i\",
      \"content\":\"Contenido $i\",
      \"pinned\":true
    }" > /dev/null
done

for i in {1..3}; do
  curl -s -X POST "$API_URL/notes" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\":\"test-user-123\",
      \"title\":\"Nota Normal $i\",
      \"content\":\"Contenido $i\",
      \"pinned\":false
    }" > /dev/null
done

# Obtener todas
NOTES=$(curl -s "$API_URL/notes?userId=test-user-123")

# Verificar orden (primero pinned, luego normales)
echo "$NOTES" | jq '[.items[] | {title, pinned}]'
```

---

## 🐛 Troubleshooting

### Error: Lambda no se actualiza

**Síntoma:** Terraform dice success pero lambda sigue con código viejo

**Solución:**
```bash
# Force update invalidando cache
aws lambda update-function-code \
  --function-name Zafira-updateThought \
  --zip-file fileb://dist/Zafira-updateThought.zip \
  --publish

# Verificar version
aws lambda get-function --function-name Zafira-updateThought \
  --query 'Configuration.Version'
```

### Error: Tags no se actualizan

**Síntoma:** PUT /thoughts retorna 200 pero tags no cambian

**Verificar:**
1. ¿Incluyes `userId` en el request?
2. ¿El formato de tags es correcto?
3. Revisar CloudWatch logs:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/Zafira-updateThought \
  --filter-pattern "updateThought" \
  --start-time $(date -u -d '5 minutes ago' +%s)000
```

**Buscar en logs:**
- `updateThought - Usando tags pre-resueltos`
- `updateThought - Tags resueltos por TagService`
- `updateThought - Sin tags`

### Error: Endpoint no encontrado (404)

**Síntoma:** POST /notes/from-list retorna 404

**Verificar:**
```bash
# Verificar que la ruta existe en API Gateway
aws apigatewayv2 get-routes \
  --api-id $(terraform output -raw api_gateway_id) \
  --query 'Items[?contains(RouteKey, `notes/from-list`)]'
```

**Solución:**
```bash
# Re-aplicar terraform
cd terraform
terraform apply -target=aws_apigatewayv2_route.routes
```

### Error: Permisos de Lambda

**Síntoma:** Error 500 al llamar endpoint

**Verificar logs:**
```bash
aws logs tail /aws/lambda/Zafira-createNoteFromList --follow
```

**Verificar permisos:**
```bash
aws lambda get-policy \
  --function-name Zafira-createNoteFromList
```

---

## 📊 Monitoreo Post-Deploy

### CloudWatch Metrics

```bash
# Ver invocaciones
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=Zafira-updateThought \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Ver errores
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=Zafira-createNoteFromList \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Dashboard CloudWatch

Crear dashboard para v0.0.8:
- Invocaciones de lambdas nuevos/actualizados
- Errores y throttles
- Duración promedio
- Logs de TagService

---

## 🔄 Rollback Plan

### Si algo sale mal:

```bash
cd terraform

# Revertir a versión anterior
terraform apply -var="lambda_version=0.0.7"

# O revertir lambda específico
aws lambda update-function-code \
  --function-name Zafira-updateThought \
  --s3-bucket saphire-lambda-backups \
  --s3-key backups/Zafira-updateThought-v007.zip
```

### Backup antes de deploy:

```bash
# Crear directorio de backups
mkdir -p backups/v007

# Backup de lambdas actuales
for lambda in updateThought getLists createList updateList createNote updateNote getNotes; do
  aws lambda get-function --function-name "Zafira-$lambda" \
    --query 'Code.Location' --output text | \
    xargs curl -o "backups/v007/Zafira-$lambda.zip"
done
```

---

## ✅ Deployment Checklist Final

- [ ] Todos los lambdas packageados en `/dist`
- [ ] Terraform plan revisado y aprobado
- [ ] Backups de lambdas v0.0.7 creados
- [ ] Deploy ejecutado sin errores
- [ ] Test 1: Tags en thoughts ✅
- [ ] Test 2: Búsqueda de listas ✅
- [ ] Test 3: Campo pinned ✅
- [ ] Test 4: Conversión lista → nota ✅
- [ ] Test 5: Ordenamiento ✅
- [ ] CloudWatch logs verificados (sin errores)
- [ ] Métricas de CloudWatch normales
- [ ] Mobile team notificado
- [ ] Documentación compartida

---

## 📢 Comunicación al Mobile Team

**Template de mensaje:**

```markdown
🎉 Backend v0.0.8 desplegado exitosamente

**Endpoint Base:** https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com

**Issues Resueltos:**
✅ PUT /thoughts/{thoughtId} - Tags ahora se actualizan correctamente
✅ GET /lists - Parámetro searchTerm disponible
✅ Filtros de fecha en GET /thoughts funcionando

**Nuevas Features:**
✨ POST /notes/from-list - Convertir listas en notas
⭐ Campo `pinned` en Lists y Notes con ordenamiento automático

**Documentación:**
📖 BACKEND_UPDATES_v0.0.8.md - Guía completa con ejemplos
📋 CHANGELOG.md - Lista detallada de cambios

**Acción Requerida:**
1. Actualizar requests de PUT /thoughts para incluir userId
2. Implementar UI para campo pinned
3. Testing de conversión lista → nota

**Testing Completado:**
✅ Tags en thoughts
✅ Búsqueda de listas
✅ Campo pinned
✅ Conversión lista → nota
✅ Ordenamiento automático

¿Preguntas? Revisar BACKEND_UPDATES_v0.0.8.md
```

---

**Última actualización:** 2025-11-16  
**Versión:** 0.0.8  
**Estado:** ⚠️ Pendiente deployment
