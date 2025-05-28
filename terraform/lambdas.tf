# terraform/lambdas.tf

locals {
  lambda_functions = [
    "saveTextMessage",
    "saveAudioMessage",
    "generateUploadUrl",
    "getMessages",
    "getMessage",
    "updateMessage",
    "deleteMessage",
    "createList",
    "getLists",
    "addItemToList",
    "deleteList",
    "deleteListItem",
    "replaceListItems",
    "createThought",
    "getThoughts",
    "getThought",
    "updateThought",
    "deleteThought",
    "createNote",
    "getNotes",
    "getNote",
    "updateNote",
    "deleteNote",
    "createTag",
    "getTags",
    "getTag",
    "updateTag",
    "deleteTag",
    "recordAction",
    "getActions",
    "createUser",
    "getUser",
    "updateUser",
  ]
}

resource "aws_lambda_function" "all" {
  for_each      = toset(local.lambda_functions)
  function_name = "${var.table_prefix}-${each.value}"
  filename      = "${var.lambda_zip_dir}/${var.table_prefix}-${each.value}.zip"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec.arn

  environment {
    variables = {
      TABLE_PREFIX = var.table_prefix
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_ddb_access,
    aws_iam_role_policy.lambda_logs
  ]
}

resource "aws_iam_role_policy" "lambda_logs" {
  name = "${var.table_prefix}-lambda-logs"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
