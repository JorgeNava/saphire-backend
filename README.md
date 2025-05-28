# Saphire Backend – AI Notes App

Este backend **serverless** provee soporte para la aplicación móvil **AI Notes App**, permitiendo registrar, transcribir, clasificar y almacenar mensajes de texto o audio usando servicios de AWS y OpenAI.

---

## ✨ Funcionalidades

- **Mensajes de texto**: `POST /messages/text` → guarda y clasifica automáticamente (OpenAI GPT-4 Turbo).  
- **URL de subida de audio**: `GET /messages/upload-url` → firma un URL S3.  
- **Mensajes de audio**: `POST /messages/audio` → transcribe con Amazon Transcribe y guarda la transcripción.  
- **Historial de mensajes**: `GET /messages` → filtra por `userId`, rango de fechas, tipo de entrada (`inputType`), clasificación o `usedAI`.  
- **Detalle de mensaje**: `GET /messages/{conversationId}/{timestamp}`.  
- **Actualizar mensaje**: `PUT /messages/{conversationId}/{timestamp}`.  
- **Eliminar mensaje**: `DELETE /messages/{conversationId}/{timestamp}`.  

- **Pensamientos**: CRUD en `/thoughts` con etiquetas IA/manual.  
- **Listas**: CRUD en `/lists` + gestión de ítems.  
- **Notas**: CRUD en `/notes` + attachments.  
- **Etiquetas**: CRUD en `/tags` con color.  
- **Registro de acciones**: POST/GET en `/actions`.  
- **Usuarios**: POST `/users`, GET/PUT `/users/{userId}` con roles e IAM.

---

## 🧱 Arquitectura

| Capa              | Tecnología                            |
|-------------------|----------------------------------------|
| Compute           | AWS Lambda (Node.js 18.x)              |
| API               | Amazon API Gateway v2 (HTTP API)       |
| Base de datos     | Amazon DynamoDB                        |
| Almacenamiento    | Amazon S3                              |
| Transcripción     | Amazon Transcribe                      |
| IA / Clasificación| OpenAI GPT-4 Turbo                     |
| CI/CD             | GitHub Actions                         |
| Infraestructura   | Terraform (estado en S3 + DynamoDB Lock)|

---

## 📁 Estructura del repositorio

```
saphire-backend/
├── .env                 # Variables locales
├── terraform/           # HCL: DynamoDB, IAM, Lambda, API Gateway, backend.tf, variables.tf
│   ├── backend.tf
│   ├── variables.tf
│   ├── dynamodb.tf
│   ├── iam.tf
│   ├── lambda.tf
│   └── api_gateway.tf
├── lambdas/             # Carpetas de funciones Lambda
│   ├── saveTextMessage/
│   │   ├── index.js
│   │   └── package.json
│   ├── saveAudioMessage/
│   └── … (todas las funciones CRUD)
├── .github/workflows/
│   └── deploy.yml       # CI/CD empaquetado, Terraform, deploy Lambdas
└── README.md            # Este archivo
```

---

## 🔧 Infraestructura con Terraform

1. **Backend remoto** en S3 + DynamoDB locks (S3 `zafira-terraform-states`, DDB `zafira-terraform-locks`).  
2. **Importar** recursos ya existentes:  
```
bash
terraform init \
  -backend-config="bucket=zafira-terraform-states" \
  -backend-config="key=env/Zafira/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=zafira-terraform-locks" \
  -backend-config="encrypt=true"

terraform import aws_dynamodb_table.messages Zafira-Messages
terraform import aws_iam_role.lambda_exec Zafira-lambda-exec-role
# …y para cada recurso que ya exista
```

3. **Variables (`variables.tf`)**:  
```
hcl
variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "table_prefix" {
  type    = string
  default = "Zafira"
}
```

4. **Permisos IAM** para CI (GitHub Actions):
   - S3: `ListBucket`, `GetObject`, `PutObject`, `DeleteObject` en `zafira-terraform-states`.  
   - DDB: CRUD + Describe en `zafira-terraform-locks`.  
   - API Gateway V2: `POST/GET/PUT/PATCH/DELETE` en `/apis*` y `TagResource`/`UntagResource` en `/apis/*`.  

---

## 🔐 Variables de entorno (app + Lambdas)

```
# .env (local)
AWS_REGION=us-east-1
TABLE_PREFIX=Zafira
DYNAMO_TABLE=Zafira-Messages
AUDIO_BUCKET=saphire-audio-notes
DELETE_AUDIO_AFTER_TRANSCRIBE=true
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

### En GitHub Secrets

| Nombre                        | Descripción                                           |
|-------------------------------|-------------------------------------------------------|
| `AWS_ACCESS_KEY_ID`           | IAM user/role con permisos infra & API Gateway V2     |
| `AWS_SECRET_ACCESS_KEY`       | Secret Key correspondiente                           |
| `TABLE_PREFIX`                | Prefijo de tablas y nombres (`Zafira`)                |
| `DELETE_AUDIO_AFTER_TRANSCRIBE` | true/false                                         |
| `AUDIO_BUCKET`                | Nombre del bucket S3                                  |
| `OPENAI_API_KEY`              | Clave API de OpenAI                                   |

---

## 🚀 CI/CD con GitHub Actions

El flujo `deploy.yml`:

1. **Checkout** →  
2. **Configurar credenciales AWS** →  
3. **Build & Zip Lambdas** (cache npm) → artefacto →  
4. **Terraform Init** (`-backend-config`, `-input=false`) →  
5. **Terraform Apply** →  
6. **Deploy Lambdas** (`aws lambda update-function-code`) →  
7. Fin.

---

## 🌐 Endpoints expuestos

| Método | Path                                              | Función Lambda         |
|--------|---------------------------------------------------|------------------------|
| POST   | `/messages/text`                                  | saveTextMessage        |
| GET    | `/messages/upload-url`                            | generateUploadUrl      |
| POST   | `/messages/audio`                                 | saveAudioMessage       |
| GET    | `/messages`                                       | getMessages            |
| GET    | `/messages/{conversationId}/{timestamp}`          | getMessage             |
| PUT    | `/messages/{conversationId}/{timestamp}`          | updateMessage          |
| DELETE | `/messages/{conversationId}/{timestamp}`          | deleteMessage          |
| POST   | `/lists`                                          | createList             |
| GET    | `/lists`                                          | getLists               |
| GET    | `/lists/{listId}`                                 | getList                |
| PUT    | `/lists/{listId}`                                 | updateList             |
| DELETE | `/lists/{listId}`                                 | deleteList             |
| POST   | `/lists/{listId}/items`                           | addItemToList          |
| PUT    | `/lists/{listId}/items`                           | replaceListItems       |
| DELETE | `/lists/{listId}/items/{itemId}`                  | deleteListItem         |
| POST   | `/thoughts`                                       | createThought          |
| GET    | `/thoughts`                                       | getThoughts            |
| GET    | `/thoughts/{thoughtId}`                           | getThought             |
| PUT    | `/thoughts/{thoughtId}`                           | updateThought          |
| DELETE | `/thoughts/{thoughtId}`                           | deleteThought          |
| POST   | `/notes`                                          | createNote             |
| GET    | `/notes`                                          | getNotes               |
| GET    | `/notes/{noteId}`                                 | getNote                |
| PUT    | `/notes/{noteId}`                                 | updateNote             |
| DELETE | `/notes/{noteId}`                                 | deleteNote             |
| POST   | `/tags`                                           | createTag              |
| GET    | `/tags`                                           | getTags                |
| GET    | `/tags/{tagId}`                                   | getTag                 |
| PUT    | `/tags/{tagId}`                                   | updateTag              |
| DELETE | `/tags/{tagId}`                                   | deleteTag              |
| POST   | `/actions`                                        | recordAction           |
| GET    | `/actions`                                        | getActions             |
| POST   | `/users`                                          | createUser             |
| GET    | `/users/{userId}`                                 | getUser                |
| PUT    | `/users/{userId}`                                 | updateUser             |

---

## 🗂️ Modelos de datos (DynamoDB)

| Tabla          | PK               | SK          | Atributos principales                                                                                      |
|----------------|------------------|-------------|-------------------------------------------------------------------------------------------------------------|
| **Users**      | userId           | —           | first, lastname, email, passwordHash/cognitoSub, roles, iamRoleArn, createdAt, updatedAt, createdBy, lastModifiedBy |
| **Messages**   | conversationId   | timestamp   | messageId, sender, content, inputType, createdAt, updatedAt, classification, usedAI, createdBy, lastModifiedBy |
| **Thoughts**   | thoughtId        | —           | userId, content, tagIds, tagSource, createdAt, updatedAt, createdBy, lastModifiedBy                         |
| **Lists**      | listId           | —           | userId, name, items[], tagIds, tagSource, createdAt, updatedAt, createdBy, lastModifiedBy                    |
| **Notes**      | noteId           | —           | userId, title, content, attachmentKeys[], tagIds, tagSource, createdAt, updatedAt, createdBy, lastModifiedBy |
| **Tags**       | tagId            | —           | userId, name, color, createdAt, updatedAt, createdBy, lastModifiedBy                                        |
| **ActionsLog** | actionId         | —           | userId, messageId?, actionType, status, details, timestamp, createdAt, updatedAt, createdBy, lastModifiedBy  |

---

## 🔒 Seguridad & Autenticación

- Se recomienda usar **AWS Cognito** o **IAM Auth** en API Gateway para proteger los endpoints.  
- Aplica CORS limitado a tu frontend.  
- Para acceso directo a Lambdas, usar roles IAM con permisos mínimos.

---

## 🧠 IA y Clasificación

- Textos clasificados con GPT-4 Turbo.  
- Etiquetas sugeridas/creadas automáticamente.  
- Configuración en `lambdas/utils/classifier.js`.

---

## 📌 Notas finales

Este backend es **altamente escalable**, completamente **serverless** y fácil de **extender** (por ejemplo, añadir Amazon Comprehend, Translate o Polly).  
¡Saphire es tu copiloto de notas con IA! ✨
