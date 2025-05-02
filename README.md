# Saphire Backend - AI Notes App

Este backend serverless provee soporte para la aplicación móvil AI Notes App, permitiendo registrar, transcribir, clasificar y almacenar mensajes de texto o audio usando servicios de AWS y OpenAI.

---

## ✨ Funcionalidades

- Guardar mensajes de texto (`POST /text`) con clasificación automática usando OpenAI
- Generar URL firmada para subir audios a S3 (`POST /generate-upload-url`)
- Procesar audios con Amazon Transcribe y guardar la transcripción (`POST /audio`)
- Obtener historial de mensajes con filtros por usuario, fechas, clasificación, inputType o si se usó IA (`GET /messages`)
- Actualizar mensajes existentes (`PUT /messages/{messageId}`)
- Eliminar mensajes existentes (`DELETE /messages/{messageId}`)

---

## 🧱 Arquitectura

| Capa          | Tecnología                    |
|---------------|-------------------------------|
| Backend       | AWS Lambda + API Gateway      |
| IA/Clasificación | OpenAI (GPT-4 Turbo)        |
| Transcripción | Amazon Transcribe             |
| Almacenamiento| Amazon S3                     |
| Base de datos | Amazon DynamoDB               |
| CI/CD         | GitHub Actions                |

---

## 📁 Estructura
```
saphire-backend/ 
├── .env
├── deploy.yml
├── lambdas/
│   ├── deleteMessage.js 
│   ├── generateUploadUrl.js 
│   ├── getMessages.js 
│   ├── processAudioMessage.js 
│   ├── saveTextMessage.js 
│   └── updateMessage.js 
└── README.md
```

---

## 🔐 Variables de entorno (.env)
```
DYNAMO_TABLE=UserMessages
AUDIO_BUCKET=saphire-audio-notes
DELETE_AUDIO_AFTER_TRANSCRIBE=true
OPENAI_API_KEY=sk-xxxxxxxxxxxx
```

---

Además, para permitir despliegues automáticos mediante GitHub Actions, necesitas configurar los siguientes secretos en el repositorio de GitHub:

| Secreto                  | Descripción                                 |
|--------------------------|---------------------------------------------|
| `AWS_ACCESS_KEY_ID`      | Access Key ID de un IAM con permisos de Lambda, S3, DynamoDB |
| `AWS_SECRET_ACCESS_KEY`  | Secret Key asociada                        |
| `AWS_ACCOUNT_ID`         | ID de tu cuenta AWS                        |
| `LAMBDA_EXECUTION_ROLE`  | Nombre del rol IAM que ejecuta las Lambdas |
| `DELETE_AUDIO_AFTER_TRANSCRIBE` | true/false                         |
| `DYNAMO_TABLE`           | Nombre de la tabla DynamoDB                |
| `AUDIO_BUCKET`           | Nombre del bucket S3                       |
| `OPENAI_API_KEY`         | API Key de OpenAI                          |

---

## 🚀 Despliegue con GitHub Actions

Archivo `.github/workflows/deploy.yml` actualizado:

- Empaqueta e instala dependencias por Lambda
- Reemplaza o crea funciones Lambda
- Actualiza código, handler y variables de entorno

---

## 🌐 Exposición del API

Todos los endpoints están expuestos vía Amazon API Gateway:

| Método | Endpoint                    | Función asociada            |
|--------|-----------------------------|------------------------------|
| POST   | `/text`                     | `saveTextMessage`           |
| POST   | `/generate-upload-url`      | `generateUploadUrl`         |
| POST   | `/audio`                    | `processAudioMessage`       |
| GET    | `/messages`                 | `getMessages`               |
| PUT    | `/messages/{messageId}`     | `updateMessage`             |
| DELETE | `/messages/{messageId}`     | `deleteMessage`             |

Parámetros de `/messages` (query string):

- `userId` (obligatorio)
- `classification` (opcional)
- `inputType` (opcional)
- `usedAI` (true/false, opcional)
- `dateFrom`, `dateTo` (ISO 8601, opcional)

---

## 🔒 Seguridad

Se recomienda proteger la API con [**AWS Cognito**](https://docs.aws.amazon.com/cognito/), firmar las solicitudes con IAM roles o tokens JWT, y aplicar CORS solo a tu frontend.

---

## 📲 Relación con Frontend

El frontend en React Native interactúa con los endpoints REST mediante axios y sigue este flujo:

- POST /text → guardar mensaje de texto
- POST /generate-upload-url → subir audio a S3
- POST /audio → transcribir y guardar
- GET /messages → historial
- PUT /messages/:id → actualizar
- DELETE /messages/:id → eliminar

---

## 🧠 IA y Clasificación

La clasificación de texto es realizada por GPT-4 Turbo usando una lista predefinida de categorías. Si no encuentra una adecuada, sugiere una nueva automáticamente.

---

## 📅 Almacenamiento y consultas

- Los mensajes se almacenan en DynamoDB con `userId` como Partition Key y `timestamp` (ISO 8601) como Sort Key.
- Las búsquedas por rango de fechas y filtros booleanos (como `usedAI`) están soportadas.

---

## 📌 Notas finales

Este backend es altamente escalable, serverless y extensible. Puedes ampliar funcionalidades fácilmente con:

- Amazon Comprehend
- Amazon Translate
- Amazon Polly

¡Saphire es tu copiloto de notas con IA! ✨
