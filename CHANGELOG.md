# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

---

## [0.0.7] - 2025-11-10

### 🐛 Corregido

#### DELETE /lists - Soporte para formato legacy del frontend
- **Problema:** Frontend enviaba `DELETE /lists` con body JSON, pero API Gateway solo tenía configurado `DELETE /lists/{listId}`
- **Solución:** Agregada ruta adicional `DELETE /lists` en API Gateway que apunta a la misma lambda
- **Impacto:** Eliminación de listas ahora funciona desde la app móvil
- **Archivos modificados:**
  - `terraform/api_gateway.tf` - Nueva ruta `delete_list_legacy`

#### GET /tags - Búsqueda case-insensitive
- **Problema:** Búsqueda por `searchTerm` era case-sensitive (limitación de DynamoDB begins_with)
- **Solución:** Implementado filtrado en memoria después del query para búsqueda case-insensitive
- **Mejoras:**
  - Búsqueda ahora usa `includes()` en lugar de `begins_with`
  - Funciona con mayúsculas, minúsculas y combinaciones
  - Mantiene ordenamiento por `usageCount`
  - Paginación manual cuando hay búsqueda activa
- **Ejemplo:** `searchTerm=trabajo` ahora encuentra "Trabajo", "TRABAJO", "trabajo personal", etc.
- **Archivos modificados:**
  - `lambdas/tags/getTags/index.js` - Lógica de filtrado mejorada

### 🔧 Modificado

#### Logging mejorado en lambdas de mensajes
- **createMessage:** Agregado logging de conversationId, sender, y confirmación de guardado
- **getMessages:** Agregado logging de parámetros de búsqueda y cantidad de resultados
- **Mejoras:** Headers `Content-Type: application/json` en todas las respuestas
- **Beneficio:** Mejor debugging y troubleshooting en producción

### 📝 Notas
- La búsqueda de tags ahora obtiene todos los tags del usuario cuando hay `searchTerm` para garantizar resultados completos
- Para usuarios con muchos tags (>1000), considerar implementar paginación con cursor en el futuro
- Ruta legacy `DELETE /lists` mantiene compatibilidad con frontend actual

---

## [0.0.6] - 2025-11-10

### 🐛 Corregido

#### Issue #5: DELETE /lists - Compatibilidad con Frontend
- **DELETE /lists/{listId}** - Soporte para múltiples formatos de request
  - Soporta path parameter: `DELETE /lists/{listId}?userId=user123` (REST estándar)
  - Soporta body: `DELETE /lists/{listId}` con `{"userId":"user123"}` (compatibilidad frontend)
  - Agregada validación de ownership antes de eliminar
  - Mejores mensajes de error con códigos HTTP apropiados (403, 404)
  - Headers `Content-Type: application/json` en todas las respuestas

#### Issue #1: updateListItem - HTTP 500
- **PUT /lists/{listId}/items/{itemId}** - Fix crítico para marcar items completados
  - Corregido error con palabra reservada `items` en DynamoDB usando `ExpressionAttributeNames`
  - Agregado manejo de items legacy sin campo `completed`
  - Valor por defecto `completed: false` para items existentes
  - Mejores mensajes de error con detalles para debugging

#### Issue #4: Update Note Tags
- **PUT /notes/{noteId}** - Fix para actualización de etiquetas en notas
  - Agregado soporte para campo `tagNames` del frontend
  - Mantiene compatibilidad con campo `tags` (formato antiguo)
  - Validación de `userId` requerido
  - TagService crea tags nuevos automáticamente
  - Actualiza correctamente `tagIds` y `tagNames`

### 🎉 Agregado

#### Issue #2: Paginación de Tags
- **GET /tags** - Implementación completa de paginación
  - Formato de respuesta paginado con `items`, `count`, `lastKey`, `hasMore`, `totalCount`
  - Soporte para parámetro `limit` (1-100, default: 25)
  - Soporte para `lastKey` (encoded base64) para navegación entre páginas
  - Búsqueda con `searchTerm` usando `begins_with` en RANGE key (case-sensitive)
  - Cálculo de `totalCount` en primera página sin búsqueda
  - Ordenamiento por `usageCount` descendente
  - Validación y manejo de errores mejorado

#### Issue #3: Tag Resources Endpoint
- **GET /tags/{tagId}/resources** - Nuevo endpoint para recursos por etiqueta
  - Obtiene tag específico con validación de ownership
  - Query en Thoughts table usando `GSI-userThoughts` con FilterExpression
  - Query en Lists table usando `GSI-userLists` con FilterExpression
  - Query en Notes table usando `GSI-userNotes` con FilterExpression
  - Retorna contadores por tipo: `thoughts`, `lists`, `notes`, `total`
  - Respuesta estructurada con tag completo y arrays de recursos

#### Nuevas Lambdas
- `getTagResources` - Obtener recursos asociados a una etiqueta

### 🔧 Modificado

#### Terraform
- Agregada Lambda `getTagResources` a `lambdas.tf`
- Agregada ruta `GET /tags/{tagId}/resources` a `api_gateway.tf`

#### Modelos de Datos
- **Tag Response (GET /tags)**: Nuevo formato paginado
  ```json
  {
    "items": [...],
    "count": 25,
    "scannedCount": 25,
    "lastKey": "encoded-key",
    "hasMore": true,
    "totalCount": 66
  }
  ```

- **Tag Resources Response**: Nueva estructura
  ```json
  {
    "tag": {...},
    "thoughts": [...],
    "lists": [...],
    "notes": [...],
    "counts": {
      "thoughts": 0,
      "lists": 1,
      "notes": 0,
      "total": 1
    }
  }
  ```

### 📝 Notas
- Todos los issues críticos reportados por Frontend Team han sido resueltos
- Backend 100% funcional para nueva pantalla de Tags en app móvil v1.3.0
- Compatibilidad mantenida con formatos anteriores donde aplica

---

## [0.0.5] - 2025-11-09

### 🎉 Agregado

#### Conversión de Pensamientos a Listas y Notas
- **POST /lists/from-thoughts** - Convierte múltiples pensamientos en items de una lista
  - Validación de ownership y límite de 50 pensamientos
  - Referencias bidireccionales con `sourceThoughtId` y `sourceThoughtCreatedAt`
  - Combina tags de pensamientos originales con tags adicionales
  - Ordenamiento automático por fecha de creación
  - Metadata: `sourceType: "thoughts"`, `createdFromThoughts: true`

- **POST /notes/from-thought** - Convierte un pensamiento individual en una nota
  - Generación automática de título desde contenido (primeros 50 caracteres)
  - Preserva contenido completo del pensamiento
  - Combina tags originales del pensamiento con tags adicionales
  - Metadata: `sourceType: "thought"`, `createdFromThought: true`
  - Referencias: `sourceThoughtId`, `sourceThoughtCreatedAt`

- **POST /lists/from-tags** - Crea lista automáticamente desde etiquetas
  - Búsqueda de pensamientos por 1-5 etiquetas (lógica OR)
  - Generación automática de nombre de lista basado en tags
  - Usa filtro `tagNames` en `GSI-userThoughts`
  - Límite de 100 pensamientos por búsqueda
  - Metadata: `sourceType: "tags"`, `createdFromTags: true`, `searchedTags`, `thoughtsFound`

#### Nuevas Lambdas
- `createListFromThoughts` - Conversión de pensamientos a lista
- `createNoteFromThought` - Conversión de pensamiento a nota
- `createListFromTags` - Creación de lista desde etiquetas

### 🔧 Modificado

#### Modelos de Datos
- **List**: Nuevos campos opcionales
  - `sourceType`: "thoughts" | "tags" | "manual"
  - `createdFromThoughts`: boolean
  - `createdFromTags`: boolean
  - `searchedTags`: array (para listas desde tags)
  - `thoughtsFound`: number (para listas desde tags)

- **ListItem**: Nuevos campos opcionales
  - `sourceThoughtId`: UUID del pensamiento origen
  - `sourceThoughtCreatedAt`: timestamp del pensamiento

- **Note**: Nuevos campos opcionales
  - `sourceType`: "thought" | "manual"
  - `sourceThoughtId`: UUID del pensamiento origen
  - `sourceThoughtCreatedAt`: timestamp del pensamiento
  - `createdFromThought`: boolean

#### Terraform
- Agregadas 3 nuevas funciones Lambda a `lambdas.tf`
- Agregadas 3 nuevas rutas a `api_gateway.tf`
- Las 3 nuevas Lambdas usan TagService Layer

### 📝 Documentación

- Plan completo de implementación en `PLAN_MESSAGE_CONVERSION.md`
- Incluye guía de funcionalidades para frontend
- Ejemplos de UI/UX para conversión de pensamientos
- Ejemplos de creación de listas desde pantalla de etiquetas

### ✨ Beneficios

**Para el Usuario:**
- Organización flexible de pensamientos en estructuras útiles
- Conversión rápida de ideas a tareas accionables
- Trazabilidad completa del origen de información
- Creación automática de listas agrupadas por temas (tags)
- Generación inteligente de nombres de lista

**Técnicos:**
- Reutilización eficiente de contenido existente
- Referencias bidireccionales para navegación
- Metadata rica para analytics y auditoría
- Aprovecha sistema de filtrado por `tagNames` ya implementado
- Escalable con lógica OR para múltiples etiquetas

---

## [0.0.4] - 2025-11-09

### 🎉 Agregado

#### Lambda Layer: TagService
- **Nuevo Lambda Layer compartido** para gestión de tags en todos los recursos
- Funciones: `parseAndResolveTags()`, `createTag()`, `incrementUsageCount()`
- Soporta tags por nombre o UUID
- Crea tags automáticamente si no existen
- Actualiza `usageCount` de tags

#### Endpoints de Audio
- **POST /messages/audio** ahora acepta `userId` además de `conversationId`
- Soporte para `tagNames` en mensajes de audio
- Integración con TagService para resolución de tags
- Transcripción con OpenAI Whisper usando axios

#### Sistema de Tags Mejorado
- **GET /messages** ahora soporta filtrado por `tagNames` además de `tagIds`
- **GET /tags** devuelve tags ordenados por `usageCount` descendente
- Campos adicionales en mensajes: `tagNames`, `tagSource`, `originalContent`

### 🔧 Modificado

#### Lambdas Actualizadas con TagService
- `createMessage` - Acepta `userId` o `conversationId`, usa TagService
- `createMessageFromAudio` - Acepta `userId`, integra TagService y axios
- `updateMessage` - Usa TagService para tags
- `createThought` - Usa TagService
- `updateThought` - Usa TagService
- `createList` - Usa TagService
- `updateList` - **Acepta `tagIds`, `tagNames` y `tagSource` directamente**
- `createNote` - Usa TagService
- `updateNote` - Usa TagService
- `getMessages` - Filtrado por `tagNames` además de `tagIds`

#### Consistencia de API
- Todos los endpoints de creación/actualización aceptan `userId` o `conversationId`
- Todos los recursos devuelven `tagNames` además de `tagIds`
- Campo `tagSource` indica si tags son "Manual" o "AI"

#### Terraform
- Nueva configuración de Lambda Layer en `lambda_layers.tf`
- Lambdas configuradas para usar TagService Layer
- Variables de entorno estandarizadas

### 🐛 Corregido

#### Mensajes de Audio
- ✅ Error 400 "conversationId requerido" - Ahora acepta `userId`
- ✅ Error en transcripción OpenAI - Cambiado de fetch a axios
- ✅ Error DynamoDB "name is reserved keyword" - Usa `ExpressionAttributeNames`

#### Listas y Tags
- ✅ Tags no se guardaban en `PUT /lists/{listId}` - Ahora acepta campos directos
- ✅ Tags se perdían al actualizar listas - Corregido mapeo de campos

#### Búsqueda de Mensajes
- ✅ Filtro por tags no funcionaba - Agregado soporte para `tagNames`
- ✅ Búsqueda case-sensitive - Ahora case-insensitive

### 🗑️ Eliminado

- Scripts temporales de migración y testing
- Documentación de debugging temporal
- `package-lock.json` de todas las Lambdas (ahora en .gitignore)
- `change.log` (ahora en .gitignore)
- `terraform/.terraform.lock.hcl` (ahora en .gitignore)

### 📦 Dependencias

#### Agregadas
- `axios@^1.6.0` en `createMessageFromAudio` - Para requests HTTP mejorados
- `aws-sdk@^2.1349.0` en TagService Layer

#### Actualizadas
- TagService Layer ahora incluye todas las dependencias necesarias

### 🔒 Seguridad

- `terraform.tfvars` agregado a .gitignore (contiene datos sensibles)
- Variables de entorno mejor organizadas

### 📝 Documentación

- Scripts de build documentados en `package.json`
- Estructura de Lambda Layer documentada

---

## [0.0.3] - 2025-11-08

### Agregado
- Migración de listas de `Lists` a `Zafira-Lists`
- Migración de tags en listas
- Sistema de tags inicial

---

## [0.0.2] - 2025-05-27

### Agregado
- Endpoints básicos de mensajes, listas, notas, thoughts
- Integración con OpenAI
- Tablas DynamoDB iniciales

---

## [0.0.1] - 2025-05-01

### Agregado
- Configuración inicial del proyecto
- Infraestructura Terraform básica
- API Gateway
- Lambdas básicas
