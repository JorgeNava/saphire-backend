# zafira-terraform

Este repositorio define la infraestructura de DynamoDB para Zafira usando Terraform, permitiendo desplegar todas las tablas de forma reproducible. Con los comandos indicados puedes inicializar el entorno, revisar el plan de cambios y aplicar la creación de recursos en AWS. Ideal para mantener tu infraestructura versionada y automatizada.

## Comandos de despliegue
### 1) Inicializar Terraform (descarga provider y configura backend)
`terraform init`

### 2) Ver plan de cambios
`terraform plan -out plan.tfplan`

### 3) Aplicar (crear tablas)
`terraform apply plan.tfplan`