variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "table_prefix" {
  type        = string
  description = "Prefijo para tablas DynamoDB, Lambdas y API Gateway"
  default     = "Zafira"
}

variable "lambda_zip_dir" {
  type        = string
  description = "Directorio donde CI deja los ZIPs de cada Lambda"
  default     = "../build"
}

variable "lambda_execution_role_name" {
  type    = string
  default = "${var.table_prefix}-lambda-exec-role"
}