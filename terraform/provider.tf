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
    bucket         = "zafira-terraform-states"      # tu bucket S3 para el state
    key            = "env/Zafira/terraform.tfstate" # ruta fija dentro del bucket
    region         = "us-east-1"                    # región del bucket y la tabla de locks
    dynamodb_table = "zafira-terraform-locks"       # tabla DynamoDB para locking
    encrypt        = true                           # cifrar el state en reposo
  }
}

provider "aws" {
  region = var.aws_region  # asegúrate de declarar var.aws_region en variables.tf
}
