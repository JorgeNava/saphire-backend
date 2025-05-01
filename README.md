# Saphire Backend - AI Notes App

Este backend serverless provee soporte para la aplicación móvil AI Notes App, permitiendo registrar, transcribir, clasificar y almacenar mensajes de texto o audio usando servicios de AWS.

---

## ✨ Funcionalidades

- Guardar mensajes de texto (`POST /text`)
- Generar URL firmada para subir audios a S3 (`POST /generate-upload-url`)
- Procesar audios con Amazon Transcribe y guardar la transcripción (`POST /audio`)
- Obtener historial de mensajes (`GET /messages`)
- Actualizar mensajes existentes (`PUT /messages/{messageId}`)
- Eliminar mensajes existentes (`DELETE /messages/{messageId}`)

---

## 🧱 Arquitectura

| Capa          | Tecnología                    |
|---------------|-------------------------------|
| Backend       | AWS Lambda + API Gateway      |
| IA/Transcribe | Amazon Transcribe             |
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
│ ├── deleteMessage.js 
│ ├── generateUploadUrl.js 
│ ├── getMessages.js 
│ ├── processAudioMessage.js 
│ ├── saveTextMessage.js 
│ └── updateMessage.js 
└── README.md
```
---

## 🔐 Variables de entorno (.env)
```
AWS_REGION=us-east-1
DYNAMO_TABLE=UserMessages
AUDIO_BUCKET=saphire-audio-notes
DELETE_AUDIO_AFTER_TRANSCRIBE=true
```
---

Además, para permitir despliegues automáticos mediante GitHub Actions, necesitas configurar los siguientes secretos en el repositorio de GitHub:

| Secreto                  | Descripción                                 |
|--------------------------|---------------------------------------------|
| `AWS_ACCESS_KEY_ID`      | Access Key ID de un IAM con permisos de Lambda, S3, DynamoDB |
| `AWS_SECRET_ACCESS_KEY`  | Secret Key asociada                        |

Estos secretos se utilizan dentro del archivo `.github/workflows/deploy.yml`.


## 🚀 Despliegue con GitHub Actions

Archivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy Lambdas

on:
  push:
    branches: [main]

jobs:
  deploy-all:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        lambda:
          - saveTextMessage
          - processAudioMessage
          - generateUploadUrl
          - getMessages
          - updateMessage
          - deleteMessage
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Deploy Lambda
        uses: aws-actions/aws-lambda-deploy@v1
        with:
          function-name: ${{ matrix.lambda }}
          zip-file: ./lambdas/${{ matrix.lambda }}.js
```
## 🌐 Exposición del API

Todas las funciones Lambda están expuestas a través de **Amazon API Gateway**, formando una REST API pública (o protegida por autenticación, según configuración). Los endpoints definidos son:

| Método | Endpoint                    | Función asociada            |
|--------|-----------------------------|------------------------------|
| POST   | `/text`                     | `saveTextMessage`           |
| POST   | `/generate-upload-url`      | `generateUploadUrl`         |
| POST   | `/audio`                    | `processAudioMessage`       |
| GET    | `/messages`                 | `getMessages`               |
| PUT    | `/messages/{messageId}`     | `updateMessage`             |
| DELETE | `/messages/{messageId}`     | `deleteMessage`             |

Se recomienda proteger estos endpoints usando [**AWS Cognito**](https://docs.aws.amazon.com/cognito/) y validación de tokens JWT en las políticas de autorización del API Gateway.

## 📝 Notas adicionales
Las funciones Lambda están diseñadas para integrarse fácilmente con API Gateway.

Se recomienda usar AWS Cognito para autenticación de usuarios y protección de endpoints.

Puedes extender con Amazon Comprehend para generar resúmenes o clasificaciones automáticas.

🔗 Relación con Frontend
Este backend es consumido por la aplicación React Native saphireMobile usando axios, y respeta el siguiente flujo:

- POST /text → guardar mensaje de texto
- POST /generate-upload-url → subir audio a S3
- POST /audio → procesar y guardar transcripción
- GET /messages → obtener historial
- PUT /messages/:id → editar mensaje
- DELETE /messages/:id → eliminar mensaje