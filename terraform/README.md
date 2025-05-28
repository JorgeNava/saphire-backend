# Saphire Backend Terraform

Este repositorio contiene la infraestructura definida en Terraform para desplegar un backend serverless usando AWS Lambda, API Gateway v2 (HTTP), DynamoDB y S3.

## 📂 Estructura de archivos

- **provider.tf**       – Configuración del proveedor AWS y backend S3/DynamoDB para el estado.
- **variables.tf**      – Definición de variables de entrada.
- **iam.tf**            – Recursos IAM: roles y políticas para las Lambdas.
- **locals.tf**         – Variables locales y lista de funciones Lambda.
- **lambdas.tf**        – Declaración de todas las funciones Lambda con un bloque `for_each`.
- **dynamodb.tf**       – Definición de tablas DynamoDB (Users, Messages, etc.).
- **api_gateway.tf**    – Configuración de API Gateway v2, integraciones, rutas y permisos.

## ⚙️ Prerrequisitos

- Terraform ≥ 1.5.0
- AWS CLI configurado con credenciales que tengan permisos para:
  - IAM (roles, políticas)
  - Lambda
  - API Gateway v2
  - DynamoDB
  - S3

## 📝 Variables de entorno / Terraform

Define las siguientes variables ya sea en `terraform.tfvars` o exportándolas en tu entorno:

$$$
AWS_REGION      = "us-east-1"
TABLE_PREFIX    = "Zafira"
lambda_zip_dir  = "../build"        # Ruta donde GitHub Actions coloca los ZIPs
DYNAMO_USERS    = "${var.TABLE_PREFIX}-Users"
DYNAMO_MESSAGES = "${var.TABLE_PREFIX}-Messages"
# … y el resto de tablas según dynamodb.tf
$$$

## 🚀 Despliegue

1. **Inicializar** el backend y descargar proveedores:

   $$$
   terraform init
   $$$

2. **Verificar** el plan de cambios:

   $$$
   terraform plan -out=tfplan
   $$$

3. **Aplicar** los cambios:

   $$$
   terraform apply -auto-approve tfplan
   $$$

---

## 📄 Descripción de los archivos

### provider.tf

- Configura el proveedor `aws` (alias único).
- Define el backend remoto en S3 (`bucket`, `key`, `region`, `dynamodb_table`, `encrypt`).

### variables.tf

- Variables reutilizables (región, prefijos, nombres de tabla, rutas de ZIP, etc.).
- Ejemplo:
  $$$
  variable "aws_region" {
    description = "Región de AWS"
    type        = string
    default     = "us-east-1"
  }
  $$$

### iam.tf

- Crea rol `lambda_exec` y políticas:
  - Permisos básicos de Lambda y CloudWatch Logs.
  - Acceso a DynamoDB y S3 (según necesites).
- Adjunta políticas al rol.

### locals.tf

- Lista local `lambda_functions` con los nombres de todas las Lambdas.
- Se usa para instanciar en bloque `for_each` en `lambdas.tf`.

### lambdas.tf

- Recurso `aws_lambda_function.all` con `for_each = toset(local.lambda_functions)`.
- Toma `filename`, `handler`, `runtime`, `role` y variables de entorno.
- Depende de la política de acceso a DynamoDB (`depends_on`).

### dynamodb.tf

- Define cada tabla DynamoDB: Users, Messages, Thoughts, Lists, Notes, Tags, ActionsLog.
- Clave de partición y ordenamiento, esquema de atributos.
- On-demand o provisionado según configuración.

### api_gateway.tf

1. **API** HTTP con `aws_apigatewayv2_api.http_api`.
2. **Integraciones** Lambda (`aws_apigatewayv2_integration.lambda`):
   - Usa `for_each` sobre un mapa `{ key = aws_lambda_function.all[key].arn }`.
3. **Rutas** (`aws_apigatewayv2_route.routes`):
   - `for_each = local.routes`
   - `route_key = "${method} ${path}"`
   - `target = "integrations/${integration.id}"`
4. **Permisos** (`aws_lambda_permission.apigw_invoke`):
   - Autoriza a API Gateway a invocar cada Lambda.

---

## 🔄 Flujo CI/CD (GitHub Actions)

- **Empaquetado** de Lambdas: instala dependencias y zip.
- **Terraform Init/Plan/Apply** con backend remoto configurado via CLI.
- Asegúrate de configurar los **secretos**:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `TABLE_PREFIX`

---

## ❗ Buenas prácticas

- No versionar carpetas `.terraform/`, archivos `*.tfstate*` ni logs.
- Utilizar bloqueos con DynamoDB para evitar concurrencia.
- Revisar IAM mínimo necesario (principio de menor privilegio).
- Mantener prefijos y convenciones de nombres consistentes.
- Documentar nuevas tablas o funciones en este README.

¡Listo! Este README cubre la configuración y uso de tus archivos Terraform en el proyecto.
