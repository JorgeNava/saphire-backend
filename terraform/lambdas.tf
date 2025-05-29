###############################################################################
# lambdas.tf
# Declaración de todas las funciones Lambda, sus variables de entorno
# y triggers de redeploy a partir del archivo ZIP
###############################################################################

locals {
  lambda_functions = [
    "createMessage",
    "createMessageFromAudio",
    "generateMessageAudioUploadUrl",
    "getMessages",
    "getMessage",
    "updateMessage",
    "deleteMessage",
    "createList",
    "getLists",
    "getList",
    "updateList",
    "deleteList",
    "addItemToList",
    "deleteListItem",
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

  # Lista de Lambdas que requieren más tiempo y memoria
  heavy_functions = [
    "createMessage",
    "createMessageFromAudio"
  ]
}

resource "aws_lambda_function" "all" {
  for_each      = toset(local.lambda_functions)
  function_name = "${local.prefix}-${each.value}"
  filename      = "${var.lambda_zip_dir}/${local.prefix}-${each.value}.zip"
  source_code_hash = filebase64sha256("${var.lambda_zip_dir}/${local.prefix}-${each.value}.zip")
  publish          = true

  handler = "index.handler"
  runtime = "nodejs18.x"
  role    = aws_iam_role.lambda_exec.arn

  # Ajuste condicional de timeout y memoria
  timeout     = contains(local.heavy_functions, each.value) ? 15 : 3
  memory_size = contains(local.heavy_functions, each.value) ? 512 : 128

  environment {
    variables = {
      TABLE_PREFIX                          = var.table_prefix
      AWS_DYNAMODB_TABLE_MESSAGES           = var.aws_dynamodb_table_messages
      AWS_DYNAMODB_TABLE_TAGS               = var.aws_dynamodb_table_tags
      AWS_DYNAMODB_TABLE_LISTS              = var.aws_dynamodb_table_lists
      AWS_DYNAMODB_TABLE_USERS              = var.aws_dynamodb_table_users
      AWS_DYNAMODB_TABLE_NOTES              = var.aws_dynamodb_table_notes
      AWS_DYNAMODB_TABLE_THOUGHTS           = var.aws_dynamodb_table_thoughts
      AWS_DYNAMODB_TABLE_ACTIONS_LOG        = var.aws_dynamodb_table_actions_log
      AWS_S3_MESSAGE_ATTACHMENTS_BUCKET     = var.aws_s3_message_attachments_bucket
      AWS_S3_NOTES_ATTACHMENTS_BUCKET       = var.aws_s3_notes_attachments_bucket
      OPENAI_API_BASE_URL                   = var.openai_api_base_url
      OPENAI_API_KEY_AWS_USE                = var.openai_api_key_aws_use
      APP_FEATURE_FLAG_DELETE_AUDIO_AFTER_TRANSCRIBE = var.app_feature_flag_delete_audio_after_transcribe ? "true" : "false"
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
