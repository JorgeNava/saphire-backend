###############################################################################
# lambdas.tf
# Declaración de todas las funciones Lambda y sus variables de entorno
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
}

resource "aws_lambda_function" "all" {
  for_each      = toset(local.lambda_functions)
  function_name = "${local.prefix}-${each.value}"
  filename      = "${var.lambda_zip_dir}/${local.prefix}-${each.value}.zip"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec.arn

  environment {
    variables = {
      TABLE_PREFIX                   = var.table_prefix
      DYNAMO_TABLE                   = var.aws_dynamodb_table_messages
      TAGS_TABLE                     = var.aws_dynamodb_table_tags
      LISTS_TABLE                    = var.aws_dynamodb_table_lists
      USERS_TABLE                    = var.aws_dynamodb_table_users
      NOTES_TABLE                    = var.aws_dynamodb_table_notes
      THOUGHTS_TABLE                 = var.aws_dynamodb_table_thoughts
      ACTIONS_LOG_TABLE              = var.aws_dynamodb_table_actions_log
      AUDIO_BUCKET                   = var.aws_s3_message_attachments_bucket
      NOTES_ATTACHMENTS_BUCKET       = var.aws_s3_notes_attachments_bucket
      OPENAI_API_BASE_URL            = var.openai_api_base_url
      OPENAI_API_KEY_AWS_USE         = var.openai_api_key_aws_use
      DELETE_AUDIO_AFTER_TRANSCRIBE  = var.app_feature_flag_delete_audio_after_transcribe ? "true" : "false"
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
