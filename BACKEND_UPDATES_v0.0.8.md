# 📡 Backend Updates - Saphire v0.0.8

**Fecha de Actualización:** 16 de noviembre de 2025  
**Versión:** 0.0.8  
**Responsable Backend:** Sistema implementado

---

## 🎯 Resumen de Cambios

Se han implementado **todas las correcciones urgentes** solicitadas por el equipo mobile, junto con **4 nuevas features** y mejoras de API.

### ✅ Issues Resueltos
1. ✅ **PUT /thoughts/{thoughtId}** - Tags ahora se actualizan correctamente
2. ✅ **GET /lists** - Agregado soporte para `searchTerm`
3. ✅ **PUT /lists/{listId}** - Tags funcionando correctamente

### 🆕 Nuevas Features
1. ✅ **POST /notes/from-list** - Convertir listas en notas
2. ✅ **Campo `pinned`** - Favoritos para Lists y Notes
3. ✅ Ordenamiento automático por `pinned` en GET

---

## 🔴 ISSUE 1: PUT /thoughts/{thoughtId} - RESUELTO ✅

### Problema Identificado
El lambda no estaba requiriendo `userId` cuando se enviaban tags para resolver, causando que `TagService` recibiera `'Manual'` como userId y fallara silenciosamente.

### Solución Implementada
```javascript
// ❌ ANTES (no funcionaba)
const { tagIds, tagNames } = await tagService.parseAndResolveTags(tags, userId || 'Manual');

// ✅ AHORA (funciona correctamente)
if (directTagIds && directTagNames) {
  // Cliente envió tags pre-resueltos
  tagIds = directTagIds;
  tagNames = directTagNames;
} else if (tags) {
  // Cliente envió tags para resolver - REQUIERE userId
  if (!userId) {
    return { statusCode: 400, error: 'userId es requerido' };
  }
  const resolved = await tagService.parseAndResolveTags(tags, userId);
  tagIds = resolved.tagIds;
  tagNames = resolved.tagNames;
}
```

### Formato de Request Correcto

**Opción 1: Enviar tags sin resolver (RECOMENDADO)**
```json
PUT /thoughts/{thoughtId}
{
  "userId": "user123",
  "content": "Contenido actualizado",
  "tags": ["Trabajo", "Urgente", "Reunión"]
}
```

**Opción 2: Enviar tags pre-resueltos**
```json
PUT /thoughts/{thoughtId}
{
  "content": "Contenido actualizado",
  "tagIds": ["uuid-1", "uuid-2"],
  "tagNames": ["Trabajo", "Urgente"],
  "tagSource": "Manual"
}
```

### Logs Añadidos
```javascript
console.log('updateThought - Usando tags pre-resueltos:', { tagIds, tagNames });
console.log('updateThought - Tags resueltos por TagService:', { tags, tagIds, tagNames });
console.log('updateThought - Sin tags');
```

---

## 🟢 ISSUE 2: GET /lists - Búsqueda por nombre ✅

### Feature Agregada
El endpoint ahora acepta tanto `name` como `searchTerm` (alias) para búsqueda.

### Request
```http
GET /lists?userId=user123&searchTerm=compras
GET /lists?userId=user123&name=compras
```

### Comportamiento
- Búsqueda con `contains()` (case-sensitive)
- Funciona con substring: "compras" encuentra "Compras del supermercado"

---

## 🟢 ISSUE 3: GET /thoughts - Filtros de fecha ✅

### Estado
**YA ESTABA IMPLEMENTADO** correctamente desde v0.0.7

### Parámetros Disponibles
```http
GET /thoughts?userId=user123&createdAt=2025-01-01T00:00:00.000Z
GET /thoughts?userId=user123&updatedAt=2025-11-01T00:00:00.000Z
```

### Formato de Fecha
- **ISO 8601**: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Operador: `>=` (mayor o igual)

### Ejemplo Completo
```http
GET /thoughts?userId=user123&createdAt=2025-01-01T00:00:00Z&updatedAt=2025-11-01T00:00:00Z&sortOrder=desc&limit=50
```

---

## 🆕 FEATURE 1: POST /notes/from-list

### Endpoint
```http
POST /notes/from-list
Content-Type: application/json

{
  "userId": "user123",
  "listId": "uuid-de-lista",
  "title": "Mi Nota desde Lista",
  "preserveList": true,
  "formatAsBullets": true,
  "tags": ["Tag1", "Tag2"]
}
```

### Parámetros

| Campo | Tipo | Requerido | Default | Descripción |
|-------|------|-----------|---------|-------------|
| `userId` | string | ✅ | - | ID del usuario |
| `listId` | string | ✅ | - | ID de la lista a convertir |
| `title` | string | ❌ | nombre de lista | Título de la nota |
| `preserveList` | boolean | ❌ | `true` | Si es `false`, elimina la lista |
| `formatAsBullets` | boolean | ❌ | `true` | Formatear items con `• ` |
| `tags` | string[] | ❌ | tags de lista | Tags adicionales |

### Respuesta (201)
```json
{
  "noteId": "uuid-nueva-nota",
  "userId": "user123",
  "title": "Mi Nota desde Lista",
  "content": "• Item 1\n• Item 2\n• Item 3",
  "tagIds": ["tag-uuid-1", "tag-uuid-2"],
  "tagNames": ["Trabajo", "Importante"],
  "sourceType": "list",
  "sourceListId": "uuid-de-lista",
  "sourceListCreatedAt": "2025-11-15T10:00:00.000Z",
  "createdFromList": true,
  "listItemCount": 3,
  "listDeleted": false,
  "createdAt": "2025-11-16T08:00:00.000Z",
  "updatedAt": "2025-11-16T08:00:00.000Z"
}
```

### Comportamiento
1. Obtiene la lista y valida ownership
2. Genera título (usa `list.name` si no se proporciona)
3. Convierte items a texto:
   - Con bullets: `• Item 1\n• Item 2\n• Item 3`
   - Sin bullets: `Item 1\nItem 2\nItem 3`
4. Combina tags de la lista + nuevos tags (si se envían)
5. Crea la nota con metadata de origen
6. **Opcionalmente** elimina la lista original

### Casos de Uso
- **Convertir lista de compras en nota**: `preserveList: true`
- **Migrar lista antigua a nota**: `preserveList: false`
- **Crear resumen de lista**: `formatAsBullets: true`

---

## 🆕 FEATURE 2: Campo `pinned` (Favoritos)

### Descripción
Se agregó el campo booleano `pinned` a **Lists** y **Notes** para marcar items como favoritos/importantes.

### Cambios en Lambdas

#### 1. Create (Lists y Notes)
```json
POST /lists
{
  "userId": "user123",
  "name": "Mi Lista Importante",
  "items": ["Item 1"],
  "pinned": true
}

POST /notes
{
  "userId": "user123",
  "title": "Nota Importante",
  "content": "...",
  "pinned": true
}
```

**Default:** `pinned: false`

#### 2. Update (Lists y Notes)
```json
PUT /lists/{listId}
{
  "userId": "user123",
  "pinned": true
}

PUT /notes/{noteId}
{
  "userId": "user123",
  "title": "...",
  "content": "...",
  "pinned": false
}
```

**Nota:** Solo se actualiza si se proporciona en el body.

#### 3. Get (Lists y Notes)
```http
GET /lists?userId=user123
GET /notes?userId=user123
```

**Ordenamiento Automático:**
1. Items con `pinned: true` **primero**
2. Luego items con `pinned: false`
3. Dentro de cada grupo: ordenar por `createdAt DESC`

### Ejemplo de Response
```json
{
  "items": [
    {
      "listId": "uuid-1",
      "name": "Lista Pinned 1",
      "pinned": true,
      "createdAt": "2025-11-16T08:00:00.000Z"
    },
    {
      "listId": "uuid-2",
      "name": "Lista Pinned 2",
      "pinned": true,
      "createdAt": "2025-11-15T08:00:00.000Z"
    },
    {
      "listId": "uuid-3",
      "name": "Lista Normal 1",
      "pinned": false,
      "createdAt": "2025-11-14T08:00:00.000Z"
    }
  ]
}
```

### Schema DynamoDB
```javascript
{
  listId: "uuid",
  userId: "user123",
  name: "Mi Lista",
  items: [...],
  pinned: true,  // ← NUEVO CAMPO
  createdAt: "2025-11-16T08:00:00.000Z",
  ...
}
```

---

## 📊 TABLA DE VERIFICACIÓN - Schemas Actualizados

### Formato Correcto para Tags

| Recurso | Create/Update | TagService | Formato Aceptado |
|---------|--------------|------------|------------------|
| **Thoughts** | ✅ | ✅ | `tags: ["string"]` o `tagIds + tagNames` |
| **Lists** | ✅ | ✅ | `tags: ["string"]` o `tagIds + tagNames` |
| **Notes** | ✅ | ✅ | `tags: ["string"]` o `tagIds + tagNames` |

### Respuesta Estándar de Recursos

Todos los recursos retornan:
```json
{
  "resourceId": "uuid",
  "userId": "user123",
  "tagIds": ["uuid-1", "uuid-2"],
  "tagNames": ["Trabajo", "Urgente"],
  "tagSource": "Manual",
  "pinned": true,
  "createdAt": "2025-11-16T08:00:00.000Z",
  "updatedAt": "2025-11-16T08:00:00.000Z"
}
```

---

## 🔧 Cambios en Terraform

### API Gateway
```hcl
# Agregado en routes
createNoteFromList = { method = "POST", path = "/notes/from-list" }
```

### Lambdas
```hcl
# Agregado en lambda_functions
"createNoteFromList"

# Agregado en tag_service_users
"createNoteFromList"
```

---

## 📋 CHECKLIST para Frontend/Mobile

### Actualizar Requests

- [ ] **PUT /thoughts/{thoughtId}** - Incluir `userId` cuando envíes `tags`
- [ ] **GET /lists** - Puedes usar `searchTerm` o `name`
- [ ] **POST /notes/from-list** - Implementar conversión de lista a nota
- [ ] **Campo `pinned`** - Agregar UI para marcar favoritos
- [ ] **Ordenamiento** - Los items pinned aparecen primero automáticamente

### Formato de Tags

**✅ RECOMENDADO (Mobile envía nombres):**
```json
{
  "userId": "user123",
  "tags": ["Trabajo", "Urgente"]
}
```

**✅ ALTERNATIVA (Mobile ya resolvió IDs):**
```json
{
  "tagIds": ["uuid-1", "uuid-2"],
  "tagNames": ["Trabajo", "Urgente"],
  "tagSource": "Manual"
}
```

---

## 🚀 Próximos Pasos (No Implementados)

Las siguientes features fueron analizadas pero **NO implementadas** en esta versión:

### 1. POST /tags/merge
**Razón:** Requiere actualización masiva de múltiples tablas (thoughts, lists, notes, messages). Necesita planificación de rollback y testing extensivo.

**Recomendación:** Implementar en v0.0.9 con:
- Transaction writes
- Batch processing
- Logging detallado
- Rollback mechanism

### 2. POST /lists/check-duplicate (IA)
**Razón:** Requiere integración con OpenAI y definición de thresholds de similitud.

**Recomendación:** Implementar junto con sistema de sugerencias en v0.1.0

### 3. Attachments en Thoughts
**Razón:** Requiere cambios en schema de DynamoDB y S3 upload policy.

**Recomendación:** Evaluar caso de uso real antes de implementar.

---

## 📞 Testing Recomendado

### 1. Test Tags en Thoughts
```bash
# Crear pensamiento con tags
curl -X POST https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com/thoughts \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user123",
    "content":"Test pensamiento",
    "tags":["Tag1","Tag2"]
  }'

# Actualizar tags (DEBE FUNCIONAR AHORA)
curl -X PUT https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com/thoughts/{thoughtId} \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user123",
    "content":"Contenido actualizado",
    "tags":["Tag3","Tag4"]
  }'
```

### 2. Test Búsqueda de Listas
```bash
curl -X GET "https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com/lists?userId=user123&searchTerm=compras"
```

### 3. Test Pinned
```bash
# Crear lista pinned
curl -X POST https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com/lists \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user123",
    "name":"Lista Importante",
    "items":["Item 1"],
    "pinned":true
  }'

# Actualizar pinned
curl -X PUT https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com/lists/{listId} \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user123",
    "pinned":false
  }'

# Verificar orden (pinned primero)
curl -X GET "https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com/lists?userId=user123"
```

### 4. Test Conversión Lista → Nota
```bash
curl -X POST https://zon9g6gx9k.execute-api.us-east-1.amazonaws.com/notes/from-list \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user123",
    "listId":"uuid-lista",
    "preserveList":true,
    "formatAsBullets":true
  }'
```

---

## 🔍 Debugging - CloudWatch Logs

### Thoughts Update
Buscar en CloudWatch:
```
updateThought - Usando tags pre-resueltos
updateThought - Tags resueltos por TagService
updateThought - Sin tags
```

### TagService
Buscar en CloudWatch:
```
TagService - parseAndResolveTags
createTag
findTagsByNames
```

---

## 📝 Deployment

### Comandos
```bash
# Package nuevo lambda
npm run package:createNoteFromList

# Terraform plan (verificar cambios)
cd terraform
terraform plan

# Deploy
terraform apply
```

### Archivos Modificados
```
lambdas/thoughts/updateThought/index.js
lambdas/lists/getLists/index.js
lambdas/lists/createList/index.js
lambdas/lists/updateList/index.js
lambdas/notes/createNote/index.js
lambdas/notes/updateNote/index.js
lambdas/notes/getNotes/index.js
lambdas/notes/createNoteFromList/index.js (NUEVO)
lambdas/notes/createNoteFromList/package.json (NUEVO)
terraform/api_gateway.tf
terraform/lambdas.tf
```

---

## ✅ Resumen Final

### Issues Resueltos: 3/3 ✅
1. ✅ PUT /thoughts - Tags actualizándose correctamente
2. ✅ GET /lists - Búsqueda por searchTerm
3. ✅ GET /thoughts - Filtros de fecha (ya existía)

### Features Nuevas: 2/2 ✅
1. ✅ POST /notes/from-list
2. ✅ Campo pinned en Lists y Notes

### Pendientes para v0.0.9
- POST /tags/merge
- POST /lists/check-duplicate (IA)
- Attachments en Thoughts

---

**Versión:** 0.0.8  
**Fecha:** 16 de noviembre de 2025  
**Estado:** ✅ LISTO PARA DEPLOY
