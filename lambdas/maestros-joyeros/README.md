# Maestros Joyeros - Lambda Functions

Este módulo contiene las funciones Lambda para el sitio web de Maestros Joyeros, consolidadas desde sus repositorios independientes al monorepo de saphire-backend.

## 📁 Estructura

```
lambdas/maestros-joyeros/
├── README.md                    # Este archivo
├── reparaciones/                # Lambda para solicitudes de reparación
│   ├── index.js
│   ├── package.json
│   ├── .env.example
│   └── node_modules/
├── agenda-de-citas/             # Lambda para agendamiento de citas
│   ├── index.js
│   ├── package.json
│   ├── .env.example
│   └── node_modules/
├── mas-vendidos/                # Lambda para consultar productos más vendidos
│   ├── index.js
│   ├── package.json
│   └── node_modules/
└── price-control/               # Lambda para control de precios
    ├── index.js
    ├── package.json
    └── node_modules/
```

## 🚀 Funciones Lambda

### 1. Reparaciones (`reparaciones/`)
**Endpoint:** https://7zy8boo9nf.execute-api.us-east-1.amazonaws.com/reparaciones

Procesa solicitudes de reparación enviadas desde el formulario del sitio web y envía notificaciones por email.

**Variables de entorno requeridas:**
- `SMTP_HOST` - Host del servidor SMTP
- `SMTP_USER` - Usuario para autenticación SMTP
- `SMTP_PASS` - Contraseña para autenticación SMTP

**Dependencias:**
- `axios` - Cliente HTTP
- `nodemailer` - Envío de emails

### 2. Agenda de Citas (`agenda-de-citas/`)
**Endpoint:** Configurado en API Gateway

Procesa solicitudes de agendamiento de citas y envía confirmaciones por email.

**Variables de entorno requeridas:**
- `SMTP_HOST` - Host del servidor SMTP
- `SMTP_USER` - Usuario para autenticación SMTP
- `SMTP_PASS` - Contraseña para autenticación SMTP

**Dependencias:**
- `axios` - Cliente HTTP
- `nodemailer` - Envío de emails

### 3. Más Vendidos (`mas-vendidos/`)
**Endpoint:** Configurado en API Gateway

Consulta y retorna información sobre los productos más vendidos.

**Dependencias:**
- `axios` - Cliente HTTP

### 4. Price Control (`price-control/`)
**Endpoint:** Configurado en API Gateway

Gestiona y controla los precios de productos.

**Dependencias:**
- `axios` - Cliente HTTP

## 🔧 Desarrollo

### Instalar Dependencias

Para instalar las dependencias de una lambda específica:

```bash
cd lambdas/maestros-joyeros/reparaciones
npm install --omit=dev
```

O para todas las lambdas:

```bash
for dir in lambdas/maestros-joyeros/*/; do
  cd "$dir"
  npm install --omit=dev
  cd -
done
```

### Build y Empaquetado

El sistema de build automático de saphire-backend detecta y empaqueta todas estas lambdas:

```bash
# Desde la raíz del proyecto
npm run build:all
```

Esto generará archivos ZIP en `lambdas/dist/`:
- `Zafira-reparaciones.zip`
- `Zafira-agenda-de-citas.zip`
- `Zafira-mas-vendidos.zip`
- `Zafira-price-control.zip`

## 🚀 Deployment

### Con Terraform

Las lambdas se despliegan automáticamente con Terraform:

```bash
cd terraform
terraform plan
terraform apply
```

### Variables de Entorno en AWS

Asegúrate de configurar las variables de entorno en AWS Lambda para las funciones que las requieren:

```bash
# Reparaciones
aws lambda update-function-configuration \
  --function-name maestros-joyeros-reparaciones \
  --environment "Variables={SMTP_HOST=smtp.example.com,SMTP_USER=user@example.com,SMTP_PASS=password}" \
  --region us-east-1

# Agenda de Citas
aws lambda update-function-configuration \
  --function-name maestros-joyeros-agenda-de-citas \
  --environment "Variables={SMTP_HOST=smtp.example.com,SMTP_USER=user@example.com,SMTP_PASS=password}" \
  --region us-east-1
```

## 📝 Migración desde Repositorios Individuales

Estas lambdas fueron migradas desde repositorios independientes:
- `maestros-joyeros-reparaciones` → `lambdas/maestros-joyeros/reparaciones/`
- `maestros-joyeros-agenda-de-citas` → `lambdas/maestros-joyeros/agenda-de-citas/`
- `maestros-joyeros-mas-vendidos` → `lambdas/maestros-joyeros/mas-vendidos/`
- `maestros-joyeros-price-control` → `lambdas/maestros-joyeros/price-control/`

**Beneficios de la migración:**
- ✅ Build y deployment unificado
- ✅ Gestión centralizada de infraestructura con Terraform
- ✅ Versionado y CI/CD consistente
- ✅ Menor overhead de mantenimiento

## 🔐 Seguridad

- Las credenciales SMTP nunca deben estar en el código
- Usar AWS Secrets Manager o variables de entorno de Lambda
- Implementar rate limiting en API Gateway
- Validar y sanitizar todos los inputs

## 📚 Referencias

- [Repositorio Original Reparaciones](https://github.com/tu-org/maestros-joyeros-reparaciones)
- [Documentación de saphire-backend](../../README.md)
- [API Gateway Endpoints](https://console.aws.amazon.com/apigateway)
