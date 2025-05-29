// -----------------------------------------------------------------------------
// iam.tf
// Define el rol de ejecución para todas las Lambdas y permisos DDB con acceso a GSIs
// -----------------------------------------------------------------------------

# 1) Creamos un local para el nombre del rol a partir de table_prefix
locals {
  lambda_execution_role_name = "${var.table_prefix}-lambda-exec-role"
}

resource "aws_iam_role" "lambda_exec" {
  name = local.lambda_execution_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
      Effect    = "Allow"
      Sid       = ""
    }]
  })
}

# Permisos básicos de CloudWatch Logs
resource "aws_iam_role_policy_attachment" "lambda_logging" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Acceso a DynamoDB
resource "aws_iam_role_policy" "lambda_ddb_access" {
  name = "${var.table_prefix}-lambda-ddb-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ]
      Effect   = "Allow"
      Resource = [
        aws_dynamodb_table.users.arn,
        aws_dynamodb_table.messages.arn,
        aws_dynamodb_table.thoughts.arn,
        aws_dynamodb_table.lists.arn,
        aws_dynamodb_table.notes.arn,
        aws_dynamodb_table.tags.arn,
        aws_dynamodb_table.actions_log.arn
      ]
    }]
  })
}

# Permiso para invocar otras Lambdas (ej. tu intent-identifier y las 3 dispatch)
resource "aws_iam_role_policy" "lambda_invoke" {
  name = "${var.table_prefix}-lambda-invoke-others"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        # Puedes usar ARN exacto o wildcard para todas tus funciones:
        Resource = [
          aws_lambda_function.all["messageIntentIdentification"].arn,
          aws_lambda_function.all["createThought"].arn,
          aws_lambda_function.all["createListThroughAI"].arn,
          aws_lambda_function.all["performResearch"].arn
        ]
      }
    ]
  })
}
