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
    "addItemToListV2",
    "deleteItemFromList",
    "deleteListItem",
    "updateListItem",
    "createListFromMessages",
    "createListFromThoughts",
    "createListFromTags",
    "refreshListFromTags",
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
    "searchNotes",
    "restoreNote",
    "createNoteFromMessage",
    "createNoteFromThought",
    "createNoteFromList",
    "addThoughtToNote",
    "createTag",
    "getTags",
    "getTag",
    "getTagResources",
    "updateTag",
    "deleteTag",
    "recordAction",
    "getActions",
    "createUser",
    "getUser",
    "updateUser",
    "performResearch",
    "createListThroughAI",
    "messageIntentIdentification"
  ]

  # Lista de Lambdas que requieren más tiempo y memoria
  heavy_functions = [
    "createMessage",
    "createMessageFromAudio",
    "messageIntentIdentification",
    "createThought",
    "createListThroughAI",
    "performResearch"
  ]

  # Lambdas que necesitan el TagService layer
  tag_service_users = [
    "createMessage",
    "createMessageFromAudio",
    "updateMessage",
    "createThought",
    "updateThought",
    "createList",
    "updateList",
    "createListFromThoughts",
    "createListFromTags",
    "createNote",
    "updateNote",
    "createNoteFromThought",
    "createNoteFromList",
    "getMessages",
    "getThoughts",
    "getLists",
    "getNotes"
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

  # Agregar Lambda Layer si la función lo necesita
  layers = contains(local.tag_service_users, each.value) ? [aws_lambda_layer_version.tag_service.arn] : []

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
      AWS_S3_BUCKET_ATTACHMENTS             = var.aws_s3_notes_attachments_bucket
      OPENAI_API_BASE_URL                   = var.openai_api_base_url
      OPENAI_API_KEY_AWS_USE                = var.openai_api_key_aws_use
      LAMBDA_NAME_CREATE_THOUGHT            = var.lambda_name_create_thought
      LAMBDA_NAME_CREATE_LIST_THROUGH_AI    = var.lambda_name_create_list_through_ai
      LAMBDA_NAME_PERFORM_RESEARCH          = var.lambda_name_perform_research
      LAMBDA_NAME_MESSAGE_INTENT_IDENTIFICATION = var.lambda_name_message_intent_identification
      APP_FEATURE_FLAG_DELETE_AUDIO_AFTER_TRANSCRIBE = var.app_feature_flag_delete_audio_after_transcribe ? "true" : "false"
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_ddb_access,
    aws_iam_role_policy.lambda_logs,
    aws_lambda_layer_version.tag_service
  ]
}

