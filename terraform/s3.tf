###############################################################################
# s3.tf
# Creación de buckets S3 para attachments de mensajes y notas,
# junto con la política IAM para que las Lambdas puedan PUT/GET/DELETE objetos.
###############################################################################

# Bucket para attachments de mensajes
resource "aws_s3_bucket" "message_attachments" {
  bucket        = var.aws_s3_message_attachments_bucket
  force_destroy = true

  tags = {
    Project     = "Zafira"
    Environment = var.table_prefix
  }
}

# Bloqueo de acceso público
resource "aws_s3_bucket_public_access_block" "message_attachments" {
  bucket                  = aws_s3_bucket.message_attachments.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# Bucket para attachments de notas
resource "aws_s3_bucket" "notes_attachments" {
  bucket        = var.aws_s3_notes_attachments_bucket
  force_destroy = true

  tags = {
    Project     = "Zafira"
    Environment = var.table_prefix
  }
}

resource "aws_s3_bucket_public_access_block" "notes_attachments" {
  bucket                  = aws_s3_bucket.notes_attachments.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# Política IAM para que las Lambdas puedan PUT/GET/DELETE en ambos buckets
resource "aws_iam_role_policy" "lambda_s3_access" {
  name = "${var.table_prefix}-lambda-s3-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ],
        Resource = [
          aws_s3_bucket.message_attachments.arn,
          "${aws_s3_bucket.message_attachments.arn}/*",
          aws_s3_bucket.notes_attachments.arn,
          "${aws_s3_bucket.notes_attachments.arn}/*"
        ]
      }
    ]
  })
}
