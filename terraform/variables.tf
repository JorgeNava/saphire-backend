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

# ——————————————
# Tablas DynamoDB
# ——————————————
variable "aws_dynamodb_table_messages" {
  description = "Nombre de la tabla Messages en DynamoDB"
  type        = string
}
variable "aws_dynamodb_table_tags" {
  description = "Nombre de la tabla Tags en DynamoDB"
  type        = string
}
variable "aws_dynamodb_table_lists" {
  description = "Nombre de la tabla Lists en DynamoDB"
  type        = string
}
variable "aws_dynamodb_table_users" {
  description = "Nombre de la tabla Users en DynamoDB"
  type        = string
}
variable "aws_dynamodb_table_notes" {
  description = "Nombre de la tabla Notes en DynamoDB"
  type        = string
}
variable "aws_dynamodb_table_thoughts" {
  description = "Nombre de la tabla Thoughts en DynamoDB"
  type        = string
}
variable "aws_dynamodb_table_actions_log" {
  description = "Nombre de la tabla ActionsLog en DynamoDB"
  type        = string
}

# ——————————————
# Buckets S3
# ——————————————
variable "aws_s3_message_attachments_bucket" {
  description = "Bucket S3 para almacenar archivos de mensajes (audio, attachments)"
  type        = string
}
variable "aws_s3_notes_attachments_bucket" {
  description = "Bucket S3 para almacenar attachments de notas"
  type        = string
}

# ——————————————
# OpenAI y flags de la aplicación
# ——————————————
variable "openai_api_base_url" {
  description = "URL base de la API de OpenAI"
  type        = string
}
variable "openai_api_key_aws_use" {
  description = "Clave API de OpenAI"
  type        = string
}
variable "app_feature_flag_delete_audio_after_transcribe" {
  description = "Flag para eliminar el audio tras la transcripción"
  type        = bool
  default     = true
}
