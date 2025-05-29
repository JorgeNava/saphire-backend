# Saphire Backend – AI Notes App

Este backend **serverless** provee soporte para la aplicación móvil **Zafira**, permitiendo registrar, transcribir, clasificar y almacenar mensajes de texto o audio usando servicios de AWS y OpenAI.

***Version actual del backend:*** 0.0.3

---

## ✨ Funcionalidades

* **Mensajes de texto**: `POST /messages` → guarda y clasifica automáticamente (OpenAI GPT-4 Turbo).

* **URL de subida de audio**: `GET /messages/upload-url` → firma un URL S3.

* **Mensajes de audio**: `POST /messages/audio` → transcribe y guarda la transcripción.

* **Historial de mensajes**: `GET /messages?conversationId={conversationId}` → devuelve todos los mensajes de una conversación.

* **Detalle de mensaje**: `GET /messages/{conversationId}/{timestamp}`.

* **Actualizar mensaje**: `PUT /messages/{conversationId}/{timestamp}`.

* **Eliminar mensaje**: `DELETE /messages/{conversationId}/{timestamp}`.

* **Pensamientos**: CRUD en `/thoughts` con detección IA/manual de etiquetas.

* **Listas**: CRUD en `/lists` + gestión de ítems (`POST /lists/{listId}/items`, `DELETE /lists/{listId}/items/{itemId}`).

* **Notas**: CRUD en `/notes` + attachments.

* **Etiquetas**: CRUD en `/tags` con asignación de color.

* **Registro de acciones**: POST/GET en `/actions`.

* **Usuarios**: POST `/users`, GET/PUT `/users/{userId}` con roles e IAM.

---

## 🧱 Arquitectura

| Capa               | Tecnología                               |
| ------------------ | ---------------------------------------- |
| Compute            | AWS Lambda (Node.js 18.x)                |
| API                | Amazon API Gateway v2 (HTTP API)         |
| Base de datos      | Amazon DynamoDB                          |
| Almacenamiento     | Amazon S3                                |
| Transcripción      | Amazon Transcribe                        |
| IA / Clasificación | OpenAI GPT-4 Turbo                       |
| CI/CD              | GitHub Actions                           |
| Infraestructura    | Terraform (estado en S3 + DynamoDB Lock) |

---

## 📁 Estructura del repositorio

```
saphire-backend/
├── .env                 # Variables locales
├── terraform/           # HCL: DynamoDB, IAM, Lambda, API Gateway
│   ├── backend.tf
│   ├── variables.tf
│   ├── dynamodb.tf
│   ├── iam.tf
│   ├── lambda.tf
│   └── api\_gateway.tf
├── lambdas/             # Carpetas de funciones Lambda
│   ├── createMessage/
│   │   ├── index.js
│   │   └── package.json
│   ├── agenerateMessageAudioUploadUrl/
│   ├── createMessageFromAudio/
│   ├── getMessage/
│   ├── getMessages/
│   ├── updateMessage/
│   ├── deleteMessage/
│   ├── createThought/
│   ├── getThoughts/
│   ├── getThought/
│   ├── updateThought/
│   ├── deleteThought/
│   ├── createList/
│   ├── getLists/
│   ├── getList/
│   ├── updateList/
│   ├── deleteList/
│   ├── addItemToList/
│   ├── deleteListItem/
│   ├── createNote/
│   ├── getNotes/
│   ├── getNote/
│   ├── updateNote/
│   ├── deleteNote/
│   ├── createTag/
│   ├── getTags/
│   ├── getTag/
│   ├── updateTag/
│   ├── deleteTag/
│   ├── recordAction/
│   ├── getActions/
│   ├── createUser/
│   ├── getUser/
│   ├── updateUser/
│   └── messageIntentIdentification/
└── .github/workflows/
└── deploy.yml       # CI/CD empaquetado, Terraform, deploy Lambdas
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
| **Messages**   | conversationId | timestamp | messageId, sender, content, inputType, createdAt, updatedAt, tagIds, usedAI, createdBy, lastModifiedBy              |
| **Thoughts**   | thoughtId      | —         | userId, content, tagIds, tagSource, createdAt, updatedAt, createdBy, lastModifiedBy                                 |
| **Lists**      | listId         | —         | userId, name, items\[], tagIds, tagSource, createdAt, updatedAt, createdBy, lastModifiedBy                          |
| **Notes**      | noteId         | —         | userId, title, content, attachmentKeys\[], tagIds, tagSource, createdAt, updatedAt, createdBy, lastModifiedBy       |
| **Tags**       | tagId          | —         | userId, name, color, createdAt, updatedAt, createdBy, lastModifiedBy                                                |
| **ActionsLog** | actionId       | —         | userId, messageId?, actionType, status, details, timestamp, createdAt, updatedAt, createdBy, lastModifiedBy         |

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
