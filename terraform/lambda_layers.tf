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
