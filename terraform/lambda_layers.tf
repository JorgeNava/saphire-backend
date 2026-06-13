###############################################################################
# lambda_layers.tf
# Definición de Lambda Layers compartidos
###############################################################################

# Layer: TagService
# Servicio compartido para gestión de etiquetas
resource "aws_lambda_layer_version" "tag_service" {
  layer_name          = "${local.prefix}-tagService"
  filename            = "${var.lambda_zip_dir}/${local.prefix}-layer-tagService.zip"
  source_code_hash    = filebase64sha256("${var.lambda_zip_dir}/${local.prefix}-layer-tagService.zip")
  compatible_runtimes = ["nodejs18.x"]
  description         = "Servicio compartido para gestión de etiquetas en recursos"

  lifecycle {
    create_before_destroy = true
  }
}

# Output para referencia
output "tag_service_layer_arn" {
  value       = aws_lambda_layer_version.tag_service.arn
  description = "ARN del Lambda Layer TagService"
}

output "tag_service_layer_version" {
  value       = aws_lambda_layer_version.tag_service.version
  description = "Versión del Lambda Layer TagService"
}

# Layer: DriveService
# Servicio compartido para integración con Google Drive
resource "aws_lambda_layer_version" "drive_service" {
  layer_name          = "${local.prefix}-driveService"
  filename            = "${var.lambda_zip_dir}/${local.prefix}-layer-driveService.zip"
  source_code_hash    = filebase64sha256("${var.lambda_zip_dir}/${local.prefix}-layer-driveService.zip")
  compatible_runtimes = ["nodejs18.x"]
  description         = "Servicio compartido para integración con Google Drive OAuth2"

  lifecycle {
    create_before_destroy = true
  }
}

output "drive_service_layer_arn" {
  value       = aws_lambda_layer_version.drive_service.arn
  description = "ARN del Lambda Layer DriveService"
}

# Layer: deps
# Deps compartidas (aws-sdk, uuid, axios, form-data, @aws-sdk/*) — antes se
# empaquetaban en cada zip (~MB). Ahora viven aquí una sola vez.
resource "aws_lambda_layer_version" "deps" {
  layer_name          = "${local.prefix}-deps"
  filename            = "${var.lambda_zip_dir}/${local.prefix}-layer-deps.zip"
  source_code_hash    = filebase64sha256("${var.lambda_zip_dir}/${local.prefix}-layer-deps.zip")
  compatible_runtimes = ["nodejs18.x"]
  description         = "Deps compartidas de las lambdas (aws-sdk v2 + @aws-sdk v3 + uuid/axios/form-data)"

  lifecycle {
    create_before_destroy = true
  }
}

output "deps_layer_arn" {
  value       = aws_lambda_layer_version.deps.arn
  description = "ARN del Lambda Layer deps"
}
