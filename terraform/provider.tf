###############################################################################
# provider.tf
# Proveedor AWS y backend remoto en S3 + DynamoDB para el state de Terraform
###############################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "zafira-terraform-state"              # Bucket S3 donde se guarda el state
    key            = "env/${var.table_prefix}/terraform.tfstate"  # Ruta dentro del bucket
    region         = var.aws_region                        # Región del bucket y locks
    dynamodb_table = "zafira-terraform-locks"              # Tabla DynamoDB para bloqueo de concurrencia
    encrypt        = true                                  # Cifrar el state en reposo
  }
}

provider "aws" {
  region = var.aws_region
}
