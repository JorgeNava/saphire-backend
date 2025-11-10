# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

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
