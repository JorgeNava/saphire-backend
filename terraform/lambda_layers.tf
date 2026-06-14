###############################################################################
# lambda_layers.tf
# Definición de Lambda Layers compartidos
###############################################################################

# Layer: awsCompat
# Adaptador aws-sdk v2 -> v3. Empaqueta el subset v3 (client-dynamodb, lib-dynamodb,
# client-lambda, client-s3) y expone la API v2 que usaban las lambdas (.promise()).
# Lo usan TODAS las funciones: reemplaza al SDK v2 que el runtime nodejs18 ya no trae.
resource "aws_lambda_layer_version" "aws_compat" {
  layer_name          = "${local.prefix}-awsCompat"
  filename            = "${var.lambda_zip_dir}/${local.prefix}-layer-awsCompat.zip"
  source_code_hash    = filebase64sha256("${var.lambda_zip_dir}/${local.prefix}-layer-awsCompat.zip")
  compatible_runtimes = ["nodejs18.x"]
  description         = "Adaptador aws-sdk v2->v3 (DynamoDB DocumentClient, Lambda, S3)"

  lifecycle {
    create_before_destroy = true
  }
}

output "aws_compat_layer_arn" {
  value       = aws_lambda_layer_version.aws_compat.arn
  description = "ARN del Lambda Layer awsCompat"
}

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
