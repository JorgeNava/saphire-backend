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
    bucket         = "zafira-terraform-state"     # nombre de tu bucket S3
    key            = "env/Zafira/terraform.tfstate" # prefijo fijo y ruta
    region         = "us-east-1"                  # región del bucket y locks
    dynamodb_table = "zafira-terraform-locks"     # tabla para locking
    encrypt        = true                         # cifrar el state en reposo
  }
}

provider "aws" {
  region = var.aws_region
}
