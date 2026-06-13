# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

---

## [0.0.11] - 2026-06-13

### ✨ Agregado
- **Lambda `exportToVault`** (programada, EventBridge diario 09:00 UTC): escribe un roll-up de
  thoughts/notes recientes al vault unificado **Segundo Cerebro** (`JorgeNava/segundo-cerebro`,
  carpeta `Pensamientos/`) vía GitHub Contents API. Standalone (sin ruta de API Gateway).
  `terraform/export_to_vault.tf` + variables `github_access_token`/`github_repo`/`github_branch`.

### 🔧 Modificado
- **Migración GPT-4 → Claude (Opus 4.8)** en los 5 handlers de generación/clasificación
  (`messageIntentIdentification`, `createThought` confirmación, `createMessageFromAudio` classifyTags,
  `driveQueryHandler` classifySubIntent + generateResponse). Llamadas vía `fetch` a la API de Anthropic
  (sin SDK, consistente con el código). Se quitó `temperature` (Opus 4.8 la rechaza). Nueva var
  `anthropic_api_key` en el env de las lambdas.
- **Whisper (transcripción de audio) se mantiene en OpenAI** — Claude no transcribe audio.

### ⚠️ Pendiente de deploy
- Agregar `github_access_token` y `anthropic_api_key` a `terraform/terraform.tfvars` (gitignoreado)
  y a los secrets de GitHub Actions. Mergear `feat/export-vault-claude` a `main` dispara el deploy.

## [0.0.10] - 2026-02-15

### 🎉 Agregado

#### Confirmaciones IA en Chat
- **createThought**: Genera confirmación natural con GPT-4 Turbo al guardar un pensamiento
- **createListThroughAI**: Confirma creación de lista mencionando nombre y cantidad de items
- **performResearch**: Confirma investigación completada con hallazgos relevantes
- **driveQueryHandler**: Guarda respuesta de consulta Drive como mensaje IA en DynamoDB
- Todas las confirmaciones se guardan como mensajes con `sender: 'IA'` en la tabla Messages
- Prompts en español con personalidad de Zafira

#### Error Fallback en Chat
- **messageIntentIdentification**: Guarda mensaje de error si la clasificación de intent falla
- **createThought**: Guarda mensaje de error si falla al crear pensamiento
- **createListThroughAI**: Guarda mensaje de error si falla al crear lista
- **performResearch**: Guarda mensaje de error si falla la investigación
- **driveQueryHandler**: Guarda mensaje de error si falla la consulta de Drive
- Todos los mensajes de error usan `intent: 'error'` para identificación
- Double-fault protection: try-catch anidado para que el error handler no crashee

### 🔧 Modificado

#### DriveService Layer — Optimización de Tamaño
- **Antes**: `googleapis` (~250MB) causaba que el layer excediera el límite de 250MB
- **Ahora**: `@googleapis/drive` (~15MB) + `google-auth-library` (~5MB) + `aws-sdk` (~60MB) ≈ **~80MB**
- Reducción de **~73%** en tamaño del layer

#### DriveService Layer — Lazy-load
- `@googleapis/drive` ahora se carga bajo demanda (lazy-load) con `getDriveClient()`
- Las lambdas de OAuth (start, callback, status, revoke) ya no cargan el módulo Drive innecesariamente
- Previene crashes en OAuth lambdas si `@googleapis/drive` tiene problemas de carga

#### DriveService Layer — Node.js 18 Compatibility
- `aws-sdk` v2 restaurado en las dependencias del layer
- Node.js 18 Lambda runtime NO incluye `aws-sdk` v2 (solo v3 `@aws-sdk/*`)
- Sin `aws-sdk` en el layer, `require('aws-sdk')` fallaba en todas las Drive lambdas

#### messageIntentIdentification
- Agregado `uuid` y `DynamoDB.DocumentClient` para guardar mensajes de error
- Variable `payload` movida fuera del `try` block para accesibilidad en `catch`

### 🐛 Corregido

- **driveQueryHandler no respondía en chat**: Ahora guarda la respuesta como mensaje IA en DynamoDB
- **OAuth lambdas crasheaban (500)**: Causado por remoción accidental de `aws-sdk` del layer
- **Silencio en errores**: Handlers fire-and-forget fallaban sin notificar al usuario

### 📊 Métricas

- **Lambdas Modificados:** 7 (driveQueryHandler, createThought, createListThroughAI, performResearch, messageIntentIdentification, driveService layer)
- **Tamaño Layer:** ~305MB → ~80MB (-73%)
- **Cobertura de Error Fallback:** 5 handlers

---

## [0.0.9] - 2026-02-14

### 🎉 Agregado

#### Integración con Google Drive OAuth2
- **Nueva funcionalidad:** Integración completa con Google Drive para consultar archivos personales del usuario
- **Flujo OAuth2:** Autenticación segura con Google Drive API
- **Endpoints de OAuth:**
  - `POST /drive/oauth/start` - Inicia flujo OAuth2 y retorna URL de autorización
  - `POST /drive/oauth/callback` - Procesa callback de Google y guarda tokens
  - `GET /drive/oauth/status` - Verifica estado de autenticación del usuario
  - `DELETE /drive/oauth` - Revoca tokens y elimina integración
- **Endpoint de Consulta:**
  - `POST /drive/query` - Consulta archivos en Google Drive del usuario
  - Búsqueda inteligente en carpeta de Libros configurada
  - Retorna archivos con metadata (nombre, tipo, tamaño, fecha modificación)
  - Soporta filtrado por tipo de archivo y búsqueda por nombre

#### Lambda Layer: DriveService
- **Nuevo Lambda Layer compartido** para integración con Google Drive
- Funciones: Gestión de OAuth2, refresh de tokens, consultas a Drive API
- Manejo automático de expiración y renovación de tokens
- Integración con tabla `UserIntegrations` para almacenamiento seguro

#### Nueva Tabla DynamoDB: UserIntegrations
- **Tabla:** `Zafira-UserIntegrations`
- **Estructura:** PK: `userId`, SK: `integrationId`
- **Propósito:** Almacenar tokens OAuth2 y configuración de integraciones externas
- **Campos:** `accessToken`, `refreshToken`, `expiresAt`, `scope`, `provider`

#### Nuevas Lambdas
- `driveOAuthStart` - Inicia flujo OAuth2 con Google
- `driveOAuthCallback` - Procesa callback y guarda tokens
- `driveOAuthStatus` - Verifica estado de autenticación
- `driveOAuthRevoke` - Revoca acceso y elimina tokens
- `driveQueryHandler` - Consulta archivos en Google Drive

### 🔧 Modificado

#### messageIntentIdentification
- **Nuevo intent:** `drive_query` para consultas sobre archivos personales
- Detecta cuando el usuario pregunta sobre "mis archivos", "libros guardados", "documentos en Drive", etc.
- Despacha automáticamente a `driveQueryHandler` cuando se detecta este intent
- Actualizado prompt de IA con descripción del nuevo intent

#### Terraform
- **api_gateway.tf** - Agregadas 5 nuevas rutas para Google Drive
- **lambdas.tf** - Agregadas 5 nuevas funciones Lambda
- **lambda_layers.tf** - Agregado DriveService Layer
- **dynamodb.tf** - Agregada tabla UserIntegrations
- **variables.tf** - Agregadas variables para Google OAuth:
  - `google_oauth_client_id`
  - `google_oauth_client_secret`
  - `google_drive_books_folder_id`
  - `app_deep_link_scheme`
  - `lambda_name_drive_query_handler`
  - `aws_dynamodb_table_user_integrations`

#### Variables de Entorno
- Todas las lambdas ahora tienen acceso a:
  - `AWS_DYNAMODB_TABLE_USER_INTEGRATIONS`
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_DRIVE_BOOKS_FOLDER_ID`
  - `APP_DEEP_LINK_SCHEME`
  - `LAMBDA_NAME_DRIVE_QUERY_HANDLER`

### 📊 Métricas

- **Nuevas Features:** 1 (Google Drive Integration)
- **Nuevos Endpoints:** 5
- **Nuevas Lambdas:** 5
- **Nuevos Lambda Layers:** 1 (DriveService)
- **Nuevas Tablas DynamoDB:** 1 (UserIntegrations)
- **Nuevos Intents:** 1 (drive_query)
- **Nuevas Variables Terraform:** 6

### 🔒 Seguridad

- OAuth2 flow completo con PKCE (Proof Key for Code Exchange)
- Tokens almacenados de forma segura en DynamoDB
- Refresh automático de tokens antes de expiración
- Revocación de tokens al eliminar integración
- Deep links seguros para callback móvil

### ✨ Beneficios

**Para el Usuario:**
- Acceso a archivos personales desde la app
- Búsqueda inteligente en biblioteca de libros
- Autenticación segura con Google
- Sin necesidad de compartir contraseñas

**Técnicos:**
- Arquitectura extensible para futuras integraciones (Dropbox, OneDrive, etc.)
- Tabla UserIntegrations reutilizable para otros servicios
- DriveService Layer compartido entre lambdas
- Manejo robusto de expiración de tokens

### 📝 Notas

- Requiere configuración de Google Cloud Console (OAuth2 Client ID y Secret)
- Requiere configuración de deep link scheme en app móvil
- Folder ID de Libros debe configurarse en variables de Terraform
- Todos los secrets deben agregarse a GitHub Secrets para CI/CD

---

## [0.0.8] - 2025-11-16

### 🐛 Corregido

#### PUT /thoughts/{thoughtId} - Tags no se actualizaban
- **Problema:** Tags no se guardaban al actualizar pensamientos
- **Causa:** `TagService` recibía `'Manual'` en lugar de `userId`, causando fallo silencioso
- **Solución:**
  - Ahora requiere `userId` cuando se envían `tags` sin resolver
  - Soporta tanto tags sin resolver como tags pre-resueltos
  - Añadidos logs de debug para troubleshooting
- **Formatos aceptados:**
  - `{ userId, content, tags: ["string"] }` (recomendado)
  - `{ content, tagIds: ["uuid"], tagNames: ["string"], tagSource: "Manual" }`

#### PUT /lists/{listId} - Validación mejorada
- Cambio de validación estricta a flexible (solo `listId` es requerido)
- UpdateExpression dinámico para soportar actualizaciones parciales
- Soporte completo para campo `pinned`

### 🎉 Agregado

#### POST /notes/from-list - Convertir Listas en Notas
- **Nuevo endpoint:** Convierte listas en notas preservando contexto
- **Funcionalidad:**
  - Formatea items con bullets (`• Item 1\n• Item 2`)
  - Combina tags de lista + tags adicionales
  - Opción de eliminar lista original (`preserveList: false`)
  - Metadata de origen completa
- **Request:**
  ```json
  {
    "userId": "user123",
    "listId": "uuid-lista",
    "title": "Mi Nota",
    "preserveList": true,
    "formatAsBullets": true,
    "tags": ["Tag1"]
  }
  ```
- **Response incluye:**
  - `sourceType: "list"`
  - `sourceListId`
  - `createdFromList: true`
  - `listItemCount`
  - `listDeleted` (boolean)

#### Campo `pinned` en Lists y Notes
- **Nuevo campo:** Marca recursos como favoritos/importantes
- **Tipo:** Boolean (default: `false`)
- **Disponible en:**
  - `POST /lists` - Create con pinned
  - `PUT /lists/{listId}` - Update pinned
  - `GET /lists` - Ordenamiento automático
  - `POST /notes` - Create con pinned
  - `PUT /notes/{noteId}` - Update pinned
  - `GET /notes` - Ordenamiento automático
- **Ordenamiento automático:**
  1. Items con `pinned: true` primero
  2. Luego items con `pinned: false`
  3. Dentro de cada grupo: por `createdAt DESC`

#### GET /lists - Parámetro searchTerm
- Agregado alias `searchTerm` para búsqueda (equivalente a `name`)
- Búsqueda con `contains()` en nombre de lista
- Ejemplo: `GET /lists?userId=user123&searchTerm=compras`

### 🔧 Modificado

#### Lambdas con UpdateExpression Dinámico
- **updateList** - Soporte para actualizaciones parciales
- **updateNote** - Soporte para campo pinned opcional

#### Ordenamiento Mejorado
- **getLists** - Ordena por pinned primero, luego por fecha
- **getNotes** - Ordena por pinned primero, luego por fecha

### 📝 Documentación

#### Nuevos Archivos
- `BACKEND_UPDATES_v0.0.8.md` - Documentación completa de cambios
  - Explicación detallada de cada fix
  - Ejemplos de request/response
  - Guía de testing
  - Checklist para mobile
  - Schema actualizado
- `lambdas/notes/createNoteFromList/` - Nuevo lambda documentado

### 🔄 Lambdas Afectados

#### Nuevos
- `Zafira-createNoteFromList` - Convertir lista a nota

#### Actualizados
- `Zafira-updateThought` - Fix tags + logs + soporte dual format
- `Zafira-getLists` - searchTerm + ordenamiento pinned
- `Zafira-createList` - Campo pinned
- `Zafira-updateList` - Campo pinned + UpdateExpression dinámico
- `Zafira-createNote` - Campo pinned
- `Zafira-updateNote` - Campo pinned + UpdateExpression dinámico
- `Zafira-getNotes` - Ordenamiento pinned

#### Configuración Terraform
- `api_gateway.tf` - Ruta createNoteFromList
- `lambdas.tf` - Lambda createNoteFromList + tag_service_users

### 📊 Métricas

- **Issues Críticos Resueltos:** 3/3 (100%)
- **Nuevas Features:** 2/2 (100%)
- **Nuevos Endpoints:** 1
- **Lambdas Creados:** 1
- **Lambdas Actualizados:** 7
- **Nuevos Campos:** 1 (pinned)

### ✅ Status

- ✅ Todos los issues urgentes resueltos
- ✅ Todas las features solicitadas implementadas
- ✅ Documentación completa generada
- ⚠️ Pendiente deployment
- ⚠️ Pendiente testing en producción

---

## [0.0.7] - 2025-11-10

### 🐛 Corregido

#### Errores 500 en Endpoints Nuevos
- **POST /lists/{listId}/refresh-from-tags** - Error de palabra reservada DynamoDB
  - Corregido uso de `items` sin escapar en UpdateExpression
  - Agregado `ExpressionAttributeNames: { '#items': 'items' }`
  - Ahora actualiza correctamente listas creadas desde tags
  
- **POST /notes/{noteId}/add-thought** - Error de estructura ZIP
  - Corregido empaquetado de lambdas (index.js en raíz del ZIP)
  - Modificado script `package-new-lambdas.sh`
  - Lambda ahora se carga correctamente

#### Tags en Mensajes del Chat No Se Guardaban
- **Problema:** Pensamientos creados desde mensajes no tenían tags
- **Causa:** Tags no se pasaban entre lambdas en el flujo de procesamiento
- **Solución:**
  - `createMessage` ahora pasa `tagIds`, `tagNames` y `tagSource` a `messageIntentIdentification`
  - `messageIntentIdentification` pasa tags al lambda correspondiente (createThought, etc.)
  - `createThought` usa tags ya resueltos si vienen en el payload
- **Resultado:** Tags se guardan correctamente en pensamientos desde chat

### 🎉 Agregado

#### Nuevos Endpoints de Gestión de Items en Listas
- **PATCH /lists/items** - Agregar item a lista
  - Lambda: `addItemToListV2`
  - Request: `{userId, listId, newItem}`
  - Genera `itemId` único automáticamente
  - Calcula `order` basado en items existentes
  - Validación de ownership
  
- **DELETE /lists/items** - Eliminar item de lista
  - Lambda: `deleteItemFromList`
  - Request: `{userId, listId, item}`
  - Filtra por contenido del item
  - Reordena items restantes automáticamente
  - Validación de ownership

#### Script de Unificación de Tags Duplicados
- **Script:** `scripts/unify-duplicate-tags.js`
- **Funcionalidad:**
  - Encuentra tags con nombres duplicados (case-insensitive)
  - Mantiene el tag más antiguo de cada grupo
  - Actualiza referencias en thoughts, lists y notes
  - Elimina tags duplicados
- **Resultado:** 10 grupos de tags duplicados unificados exitosamente

### 🔧 Modificado

#### Documentación de Filtrado por Tags
- **GET /thoughts** - Documentación mejorada sobre `tagIds` vs `tagNames`
  - `tagIds`: Recomendado - Coincidencia exacta con UUIDs
  - `tagNames`: Legacy - Puede tener falsos positivos (usa substring)
  - Agregados comentarios explicativos en código
  
#### Script de Empaquetado
- **scripts/package-new-lambdas.sh**
  - Corregido para crear ZIPs con estructura correcta
  - `index.js` ahora en raíz del ZIP (no en subcarpeta)
  - Excluye archivos `.git*` y `.DS_Store`

### 📝 Documentación

#### Nuevos Archivos
- `FRONTEND_FIX_FILTRADO_TAGS.md` - Instrucciones para cambiar de tagNames a tagIds
- `RESUMEN_SESION_NOV_10.md` - Resumen completo de todos los cambios
- `scripts/package.json` - Dependencias para scripts de mantenimiento

### 🔄 Lambdas Desplegados

#### Nuevos
- `Zafira-addItemToListV2` - Agregar items a listas
- `Zafira-deleteItemFromList` - Eliminar items de listas

#### Actualizados
- `Zafira-createMessage` - Pasar tags a intent identifier
- `Zafira-messageIntentIdentification` - Pasar tags a lambdas correspondientes
- `Zafira-createThought` - Usar tags ya resueltos
- `Zafira-refreshListFromTags` - Escapar palabra reservada
- `Zafira-addThoughtToNote` - Estructura ZIP corregida
- `Zafira-getThoughts` - Documentación mejorada

### 📊 Métricas

- **Bugs Críticos Corregidos:** 5/5 (100%)
- **Nuevos Endpoints:** 2
- **Lambdas Creados:** 2
- **Lambdas Actualizados:** 6
- **Tags Duplicados Unificados:** 10 grupos
- **Scripts Creados:** 1

### ⚠️ Acción Requerida en Frontend

**Alta Prioridad:** Cambiar filtrado de pensamientos de `tagNames` a `tagIds`
- **Razón:** `tagNames` usa substring y tiene falsos positivos
- **Solución:** Usar `tagIds` para coincidencia exacta
- **Cambio:** 1 línea de código (`.map(tag => tag.id)` en lugar de `.map(tag => tag.name)`)
- **Documentación:** Ver `FRONTEND_FIX_FILTRADO_TAGS.md`

### 📝 Notas

- Todos los bugs críticos reportados por el equipo de frontend han sido corregidos
- Backend 100% funcional para app móvil v1.5.1+
- Sistema de tags completamente funcional con validación única
- Gestión completa de items en listas (agregar, eliminar, actualizar)
- Flujo de mensajes a pensamientos con tags funcionando correctamente

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
