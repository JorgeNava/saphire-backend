###############################################################################
# variables.tf
# Variables de entrada para todo el proyecto Terraform de Zafira
###############################################################################

variable "aws_region" {
  description = "Región de AWS donde se desplegarán los recursos"
  type        = string
  default     = "us-east-1"
}

variable "table_prefix" {
  description = "Prefijo que se usará en nombres de tablas DynamoDB, Lambdas y API Gateway"
  type        = string
  default     = "Zafira"
}

variable "lambda_zip_dir" {
  description = "Ruta relativa (desde el directorio de Terraform) donde el CI deposita los ZIPs de cada función Lambda"
  type        = string
  default     = "../build"
}
