# Saphire Backend – AI Notes App

Este backend **serverless** provee soporte para la aplicación móvil **Zafira**, permitiendo registrar, transcribir, clasificar y almacenar mensajes de texto o audio usando servicios de AWS y OpenAI.

***Versión actual del backend:*** 0.0.8

**🎉 Novedades v0.0.8:**
- 🐛 **Fix crítico:** Tags ahora se actualizan correctamente en pensamientos (`PUT /thoughts/{thoughtId}`)
- ✨ **Nuevo endpoint:** Convertir listas en notas (`POST /notes/from-list`)
- ⭐ **Nueva feature:** Campo `pinned` (favoritos) en Lists y Notes
- � **Mejora:** Búsqueda por nombre en listas con parámetro `searchTerm`
- 📊 **Mejora:** Ordenamiento automático por favoritos en GET /lists y /notes
- 📝 Soporte dual para tags: nombres sin resolver o IDs pre-resueltos
- � UpdateExpression dinámico para actualizaciones parciales

**Novedades v0.0.6:**
- Fix crítico: marcar items de lista completados
- Paginación completa en endpoint de tags
- Nuevo endpoint: recursos por etiqueta
- Fix: actualización de tags en notas
- Backend 100% funcional para pantalla Tags v1.3.0

---

## ✨ Funcionalidades

### 💬 Mensajes
* **Mensajes de texto**: `POST /messages` → Acepta `userId` o `conversationId`, clasifica con IA
* **URL de subida de audio**: `POST /messages/upload-url` → Genera URL firmada de S3
* **Mensajes de audio**: `POST /messages/audio` → Transcribe con Whisper, acepta `userId` y `tagNames`
* **Historial**: `GET /messages?userId={userId}` → Filtra por `tagNames` o `tagIds`
* **Detalle**: `GET /messages/{conversationId}/{timestamp}`
* **Actualizar**: `PUT /messages/{conversationId}/{timestamp}`
* **Eliminar**: `DELETE /messages/{conversationId}/{timestamp}`

### 🏷️ Sistema de Tags
* **CRUD completo**: `/tags` con colores y `usageCount`
* **Validación única**: Nombres únicos por usuario (case-insensitive) 🆕
* **Paginación**: `GET /tags` con `limit`, `lastKey`, `searchTerm` y `totalCount`
* **Recursos por tag**: `GET /tags/{tagId}/resources` - Obtiene thoughts, lists y notes asociados
* **Resolución automática**: TagService crea tags si no existen
* **Filtrado avanzado**: Por nombre o UUID en todos los recursos
* **Clasificación IA**: Tags automáticos en mensajes de audio

### 💭 Pensamientos
* **CRUD**: `/thoughts` con detección IA/manual de tags
* **Creación automática**: Desde mensajes con intent "pensamiento"
* **Conversión a lista**: `POST /lists/from-thoughts` - Convierte múltiples pensamientos en lista
* **Conversión a nota**: `POST /notes/from-thought` - Convierte pensamiento individual en nota

### 📋 Listas
* **CRUD**: `/lists` con soporte completo de tags
* **Gestión de items**: `POST /lists/{listId}/items`, `DELETE /lists/{listId}/items/{itemId}`
* **Marcar completados**: `PUT /lists/{listId}/items/{itemId}` - Toggle estado `completed`
* **Favoritos**: Campo `pinned` para marcar listas importantes con ordenamiento automático 🆕
* **Búsqueda**: Parámetro `searchTerm` en GET para filtrar por nombre 🆕
* **Tags directos**: Acepta `tagIds`, `tagNames` y `tagSource` en actualizaciones
* **Creación desde tags**: `POST /lists/from-tags` - Crea lista automáticamente desde 1-5 etiquetas
* **Refresh desde tags**: `POST /lists/{listId}/refresh-from-tags` - Actualiza lista con pensamientos nuevos
* **Conversión a nota**: `POST /notes/from-list` - Convierte lista en nota con formato bullets 🆕

### 📝 Notas
* **CRUD**: `/notes` con attachments en S3
* **Favoritos**: Campo `pinned` para marcar notas importantes con ordenamiento automático 🆕
* **Tags**: Soporte completo con TagService (acepta `tags` y `tagNames`)
* **Conversión desde lista**: `POST /notes/from-list` - Crea nota desde lista con formato bullets 🆕
* **Conversión desde pensamiento**: `POST /notes/from-thought` - Crea nota desde pensamiento individual
* **Agregar pensamiento**: `POST /notes/{noteId}/add-thought` - Agrega pensamiento como bullet point
* **Actualización de tags**: `PUT /notes/{noteId}` crea tags automáticamente si no existen

### 👤 Usuarios
* **Registro**: `POST /users`
* **Perfil**: `GET/PUT /users/{userId}` con roles e IAM

### 📊 Registro de Acciones
* **Log**: `POST /actions` para auditoría
* **Consulta**: `GET /actions?userId={userId}`

---

## 🧱 Arquitectura

| Capa               | Tecnología                               |
| ------------------ | ---------------------------------------- |
| Compute            | AWS Lambda (Node.js 18.x)                |
| Shared Code        | Lambda Layers (TagService)               |
| API                | Amazon API Gateway v2 (HTTP API)         |
| Base de datos      | Amazon DynamoDB                          |
| Almacenamiento     | Amazon S3                                |
| Transcripción      | OpenAI Whisper API                       |
| IA / Clasificación | OpenAI GPT-4 Turbo                       |
| CI/CD              | GitHub Actions                           |
| Infraestructura    | Terraform (estado en S3 + DynamoDB Lock) |

---

## 📁 Estructura del repositorio

```
saphire-backend/
├── .env                     # Variables locales (ignorado)
├── .gitignore               # Archivos ignorados
├── package.json             # Scripts de build
├── CHANGELOG.md             # Historial de cambios
├── README.md                # Este archivo
├── terraform/               # Infraestructura como código
│   ├── backend.tf           # Backend remoto S3
│   ├── variables.tf         # Variables de Terraform
│   ├── dynamodb.tf          # Tablas DynamoDB
│   ├── iam.tf               # Roles y políticas
│   ├── lambdas.tf           # Funciones Lambda
│   ├── lambda_layers.tf     # Lambda Layers (TagService)
│   └── api_gateway.tf       # API Gateway HTTP
├── lambdas/                 # Funciones Lambda
│   ├── layers/              # Lambda Layers compartidos
│   │   └── tagService/      # Layer para gestión de tags
│   │       ├── build.sh
│   │       └── nodejs/
│   │           ├── tagService.js
│   │           └── package.json
│   ├── messages/            # Endpoints de mensajes
│   │   ├── createMessage/
│   │   ├── createMessageFromAudio/
│   │   ├── getMessages/
│   │   ├── getMessage/
│   │   ├── updateMessage/
│   │   ├── deleteMessage/
│   │   └── generateMessageAudioUploadUrl/
│   ├── thoughts/            # Endpoints de pensamientos
│   ├── lists/               # Endpoints de listas
│   ├── notes/               # Endpoints de notas
│   ├── tags/                # Endpoints de tags
│   ├── actions/             # Endpoints de acciones
│   ├── users/               # Endpoints de usuarios
│   └── dist/                # ZIPs empaquetados (ignorado)
├── scripts/                 # Scripts de utilidad
│   ├── build-all.sh         # Build completo (Layer + Lambdas)
│   └── package-all-lambdas.sh  # Empaquetar todas las Lambdas
└── .github/workflows/
    └── deploy.yml           # CI/CD con GitHub Actions
```

---

## 🔧 Infraestructura con Terraform

1. **Backend remoto** en S3 + DynamoDB locks (S3 `zafira-terraform-states`, DDB `zafira-terraform-locks`).
2. **Importar** recursos existentes:
```bash
terraform init \\
-backend-config="bucket=zafira-terraform-states" \\
-backend-config="key=env/Zafira/terraform.tfstate" \\
-backend-config="region=us-east-1" \\
-backend-config="dynamodb\_table=zafira-terraform-locks" \\
-backend-config="encrypt=true"
```

***…y para cada recurso***
```bash
terraform import aws\_dynamodb\_table.messages Zafira-Messages
terraform import aws\_iam\_role.lambda\_exec Zafira-lambda-exec-role
```

3. **Variables (`variables.tf`)**:
```tf
variable "aws\_region" {
type    = string
default = "us-east-1"
}
variable "table\_prefix" {
type    = string
default = "Zafira"
}
```

4. **Permisos IAM** para CI:

   * S3: `ListBucket`, `GetObject`, `PutObject`, `DeleteObject` en el bucket de estados.
   * DDB: CRUD + Describe en locks.
   * API Gateway V2: `POST/GET/PUT/PATCH/DELETE` en `/apis*`, `TagResource/UntagResource` en `/apis/*`.

---

## 🔐 Variables de entorno (app + Lambdas)

```env
# Configuración de la aplicación
APP_NAME=
APP_VERSION=
APP_FEATURE_FLAG_DELETE_AUDIO_AFTER_TRANSCRIBE=

# AWS genérico
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Tablas DynamoDB
AWS_DYNAMODB_TABLE_MESSAGES=
AWS_DYNAMODB_TABLE_TAGS=
AWS_DYNAMODB_TABLE_LISTS=
AWS_DYNAMODB_TABLE_USERS=
AWS_DYNAMODB_TABLE_NOTES=
AWS_DYNAMODB_TABLE_THOUGHTS=
AWS_DYNAMODB_TABLE_ACTIONS_LOG=

# S3 (credenciales)
AWS_S3_ACCESS_KEY_ID=
AWS_S3_SECRET_ACCESS_KEY=

# S3 Buckets de attachments
AWS_S3_MESSAGE_ATTACHMENTS_BUCKET=
AWS_S3_NOTES_ATTACHMENTS_BUCKET=

# OpenAI
OPENAI_API_ENDPOINT=
OPENAI_API_KEY_AWS_USE=

# GitHub
GITHUB_ACCESS_TOKEN=
```

### En GitHub Secrets

Para que tu CI/CD y tus Lambdas en AWS reciban en tiempo de ejecución las mismas variables que defines localmente en tu `.env`, debes **duplicar cada par clave‐valor** en los *GitHub Secrets* de tu repositorio. Así tus workflows podrán inyectar esos valores de forma segura sin exponerlos en el código.

#### Pasos recomendados

1. **Abrir la configuración** de tu repositorio en GitHub.
2. Navegar a **Settings → Secrets and variables → Actions**.
3. Hacer clic en **“New repository secret”**.
4. Por cada variable de tu `.env`, crea un secret con el **mismo nombre** (por ejemplo `AWS_REGION`, `OPENAI_API_KEY_AWS_USE`, `AWS_S3_MESSAGE_ATTACHMENTS_BUCKET`, etc.) y pégale el valor correspondiente.
5. Repite hasta haber añadido todas las variables listadas en tu `.env`:
   * `APP_NAME`
   * `APP_VERSION`
   * `APP_FEATURE_FLAG_DELETE_AUDIO_AFTER_TRANSCRIBE`
   * `AWS_REGION`
   * `AWS_ACCESS_KEY_ID`
   * `AWS_SECRET_ACCESS_KEY`
   * `AWS_DYNAMODB_TABLE_MESSAGES`
   * …y así con cada tabla, bucket, clave de OpenAI y token de GitHub.
6. Una vez guardados, tu workflow de GitHub Actions podrá referirse a ellos como `${{ secrets.NOMBRE_DEL_SECRET }}` y pasarlos a Terraform o a AWS CLI sin riesgo de fuga.

De este modo, la sección de **“En GitHub Secrets”** de tu README servirá como guía práctica para cualquier colaborador que deba replicar en su fork o en un nuevo entorno la configuración completa de variables de entorno.

---

## 🌐 Endpoints expuestos

| Método | Path                                        | Función Lambda                 |
| ------ | ------------------------------------------- | ------------------------------ |
| POST   | `/messages`                                 | createMessage                  |
| GET    | `/messages/upload-url`                      | agenerateMessageAudioUploadUrl |
| POST   | `/messages/audio`                           | createMessageFromAudio         |
| GET    | `/messages?conversationId={conversationId}` | getMessages                    |
| GET    | `/messages/{conversationId}/{timestamp}`    | getMessage                     |
| PUT    | `/messages/{conversationId}/{timestamp}`    | updateMessage                  |
| DELETE | `/messages/{conversationId}/{timestamp}`    | deleteMessage                  |
| POST   | `/lists`                                    | createList                     |
| GET    | `/lists?userId={userId}`                    | getLists                       |
| GET    | `/lists/{listId}`                           | getList                        |
| PUT    | `/lists/{listId}`                           | updateList                     |
| DELETE | `/lists/{listId}`                           | deleteList                     |
| POST   | `/lists/{listId}/items`                     | addItemToList                  |
| DELETE | `/lists/{listId}/items/{itemId}`            | deleteListItem                 |
| POST   | `/lists/from-thoughts`                      | createListFromThoughts         |
| POST   | `/lists/from-tags`                          | createListFromTags             |
| POST   | `/thoughts`                                 | createThought                  |
| GET    | `/thoughts?userId={userId}`                 | getThoughts                    |
| GET    | `/thoughts/{thoughtId}`                     | getThought                     |
| PUT    | `/thoughts/{thoughtId}`                     | updateThought                  |
| DELETE | `/thoughts/{thoughtId}`                     | deleteThought                  |
| POST   | `/notes`                                    | createNote                     |
| GET    | `/notes?userId={userId}`                    | getNotes                       |
| GET    | `/notes/{noteId}`                           | getNote                        |
| PUT    | `/notes/{noteId}`                           | updateNote                     |
| DELETE | `/notes/{noteId}`                           | deleteNote                     |
| POST   | `/notes/from-thought`                       | createNoteFromThought          |
| POST   | `/tags`                                     | createTag                      |
| GET    | `/tags?userId={userId}`                     | getTags                        |
| GET    | `/tags/{tagId}`                             | getTag                         |
| PUT    | `/tags/{tagId}`                             | updateTag                      |
| DELETE | `/tags/{tagId}`                             | deleteTag                      |
| POST   | `/actions`                                  | recordAction                   |
| GET    | `/actions?userId={userId}`                  | getActions                     |
| POST   | `/users`                                    | createUser                     |
| GET    | `/users/{userId}`                           | getUser                        |
| PUT    | `/users/{userId}`                           | updateUser                     |

---

## 🗂️ Modelos de datos (DynamoDB)

| Tabla          | PK             | SK        | Atributos principales                                                                                               |
| -------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| **Users**      | userId         | —         | first, lastname, email, passwordHash/cognitoSub, roles, iamRoleArn, createdAt, updatedAt, createdBy, lastModifiedBy |
| **Messages**   | conversationId | timestamp | messageId, sender, content, originalContent, inputType, s3Key, transcription, tagIds, **tagNames**, **tagSource**, usedAI, createdAt, updatedAt, createdBy, lastModifiedBy |
| **Thoughts**   | thoughtId      | —         | userId, content, tagIds, **tagNames**, tagSource, createdAt, updatedAt, createdBy, lastModifiedBy                   |
| **Lists**      | listId         | —         | userId, name, items\[], tagIds, **tagNames**, tagSource, **sourceType**, **createdFromThoughts**, **createdFromTags**, **searchedTags**, **thoughtsFound**, createdAt, updatedAt, createdBy, lastModifiedBy            |
| **Notes**      | noteId         | —         | userId, title, content, attachmentKeys\[], tagIds, **tagNames**, tagSource, **sourceType**, **sourceThoughtId**, **sourceThoughtCreatedAt**, **createdFromThought**, createdAt, updatedAt, createdBy, lastModifiedBy |
| **Tags**       | tagId          | —         | userId, name, color, **usageCount**, createdAt, updatedAt, createdBy, lastModifiedBy                                |
| **ActionsLog** | actionId       | —         | userId, messageId?, actionType, status, details, timestamp, createdAt, updatedAt, createdBy, lastModifiedBy         |

**Campos nuevos en v0.0.5:**
- `sourceType`: Tipo de origen ("thoughts" | "tags" | "thought" | "manual")
- `createdFromThoughts`: Boolean, indica si lista fue creada desde pensamientos
- `createdFromTags`: Boolean, indica si lista fue creada desde etiquetas
- `searchedTags`: Array de tags usados para buscar pensamientos
- `thoughtsFound`: Número de pensamientos encontrados al crear desde tags
- `sourceThoughtId`: UUID del pensamiento origen (en notas y list items)
- `sourceThoughtCreatedAt`: Timestamp del pensamiento origen
- `createdFromThought`: Boolean, indica si nota fue creada desde pensamiento

**Campos nuevos en v0.0.4:**
- `tagNames`: Array de nombres de tags (para UI)
- `tagSource`: "Manual" o "AI" (origen de los tags)
- `usageCount`: Contador de uso de cada tag
- `originalContent`: Contenido original antes de modificaciones
- `transcription`: Texto transcrito de audio

---

## 🚀 Desarrollo

### Scripts Disponibles

```bash
# Build completo (Layer + Lambdas modificadas)
npm run build:all

# Empaquetar todas las Lambdas
npm run build:lambdas

# Build solo del Layer TagService
npm run build:layer
```

### Lambda Layer: TagService

El TagService es un Layer compartido que proporciona funciones comunes para gestión de tags:

```javascript
const { TagService } = require('/opt/nodejs/tagService');
const tagService = new TagService();

// Resolver tags (por nombre o UUID)
const { tagIds, tagNames } = await tagService.parseAndResolveTags(
  ['Trabajo', 'Importante'],  // Tags de entrada
  'user123'                    // userId
);

// Crear tag si no existe
const tag = await tagService.createTag('NuevoTag', 'user123');

// Incrementar contador de uso
await tagService.incrementUsageCount('tagId123');
```

**Lambdas que usan TagService:**
- `createMessage`, `updateMessage`
- `createMessageFromAudio`
- `createThought`, `updateThought`
- `createList`, `updateList`
- `createListFromThoughts`, `createListFromTags`
- `createNote`, `updateNote`
- `createNoteFromThought`

---

## Cómo se crean los pensamientos

Cuando un usuario envía un mensaje (nunca AI), el sistema invoca en paralelo dos Lambdas:

1. **`createMessage`** – almacena el mensaje en la base de datos.
2. **`messageIntentIdentification`** – utiliza IA para detectar la intención del mensaje.

El detector de intención puede clasificar los mensajes como:

* **Registro de pensamiento**: capturar ideas o notas personales para tu “segundo cerebro”.
* **Operaciones de datos**: invocar Lambdas CRUD (listas, notas, etiquetas).
* **Consultas de investigación**: búsqueda profunda y compilación en nota.

Si la intención es **pensamiento**, `messageIntentIdentification` llama a **`createThought`** automáticamente; también puedes usar su endpoint HTTP directamente.

---

## 🔒 Seguridad & Autenticación

* Usar **AWS Cognito** o **IAM Auth** en API Gateway.
* CORS restringido.
* Roles IAM con permisos mínimos.

---

## 🧠 IA y Clasificación

* GPT-4 Turbo para clasificación de texto y etiquetas.
* Etiquetas derivadas automáticamente o asignadas manualmente.

---

## 📌 Notas finales

Este backend es **altamente escalable**, **serverless** y fácil de **extender** (Comprehend, Translate, Polly, etc.).
¡Saphire es tu copiloto de notas con IA! ✨
