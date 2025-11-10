###############################################################################
# iam.tf
# Define el rol que usan las Lambdas y sus políticas de acceso:
#  - CloudWatch Logs
#  - DynamoDB (Get/Put/Update/Delete/Query/Scan)
#  - Lambda:InvokeFunction para disparar otras Lambdas
###############################################################################

# 0) Datos de cuenta actual
data "aws_caller_identity" "current" {}

# 1) Rol de ejecución para Lambda
resource "aws_iam_role" "lambda_exec" {
  name = "${var.table_prefix}-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 2) Permisos para escribir logs en CloudWatch
resource "aws_iam_role_policy" "lambda_logs" {
  name = "${var.table_prefix}-lambda-logs"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# 3) Permisos completos de lectura/escritura/consulta en DynamoDB
resource "aws_iam_role_policy" "lambda_ddb_access" {
  name = "${var.table_prefix}-lambda-ddb-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          # Todas las tablas con tu prefijo
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.table_prefix}-*",
          # Todos los índices GSI
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.table_prefix}-*/index/*"
        ]
      }
    ]
  })
}

# 4) Permiso para invocar otras Lambdas (InvokeFunction)
resource "aws_iam_role_policy" "lambda_invoke" {
  name = "${var.table_prefix}-lambda-invoke"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${local.prefix}-*"
      }
    ]
  })
}
