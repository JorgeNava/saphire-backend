// -----------------------------------------------------------------------------
// iam.tf
// Define el rol de ejecución para todas las Lambdas
// -----------------------------------------------------------------------------

# 1) Creamos un local para el nombre del rol a partir de table_prefix
locals {
  lambda_execution_role_name = "${var.table_prefix}-lambda-exec-role"
}

# 2) IAM Role para Lambda
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

# 3) Políticas adjuntas
resource "aws_iam_role_policy_attachment" "lambda_logging" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

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
