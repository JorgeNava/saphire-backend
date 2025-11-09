################################################################################
# 1. Users
################################################################################
resource "aws_dynamodb_table" "users" {
  name         = "${local.prefix}-Users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "email"
    type = "S"
  }

  tags = {
    Project = "Zafira"
  }

  global_secondary_index {
    name               = "GSI-email"
    hash_key           = "email"
    projection_type    = "ALL"
  }
}

################################################################################
# 2. Messages
################################################################################
resource "aws_dynamodb_table" "messages" {
  name         = "${local.prefix}-Messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "conversationId"
  range_key    = "timestamp"

  attribute {
    name = "conversationId"
    type = "S"
  }
  attribute {
    name = "timestamp"
    type = "S"
  }

  tags = {
    Project = "Zafira"
  }
}

################################################################################
# 3. Thoughts
################################################################################
resource "aws_dynamodb_table" "thoughts" {
  name         = "${local.prefix}-Thoughts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "thoughtId"

  attribute {
    name = "thoughtId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "createdAt"
    type = "S"
  }

  tags = {
    Project = "Zafira"
  }

  global_secondary_index {
    name            = "GSI-userThoughts"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }
}

################################################################################
# 4. Lists
################################################################################
resource "aws_dynamodb_table" "lists" {
  name         = "${local.prefix}-Lists"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "listId"

  attribute {
    name = "listId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "name"
    type = "S"
  }

  tags = {
    Project = "Zafira"
  }

  global_secondary_index {
    name            = "GSI-userLists"
    hash_key        = "userId"
    range_key       = "name"
    projection_type = "ALL"
  }
}

################################################################################
# 5. Notes
################################################################################
resource "aws_dynamodb_table" "notes" {
  name         = "${local.prefix}-Notes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "noteId"

  attribute {
    name = "noteId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "title"
    type = "S"
  }

  tags = {
    Project = "Zafira"
  }

  global_secondary_index {
    name            = "GSI-userNotes"
    hash_key        = "userId"
    range_key       = "title"
    projection_type = "ALL"
  }
}

################################################################################
# 6. Tags
################################################################################
resource "aws_dynamodb_table" "tags" {
  name         = "${local.prefix}-Tags"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tagId"

  attribute {
    name = "tagId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "name"
    type = "S"
  }

  tags = {
    Project = "Zafira"
  }

  global_secondary_index {
    name            = "GSI-userTags"
    hash_key        = "userId"
    range_key       = "name"
    projection_type = "ALL"
  }

  # Nota: usageCount se agregará automáticamente cuando se use
  # DynamoDB es schema-less, no requiere definición previa
}

################################################################################
# 7. ActionsLog
################################################################################
resource "aws_dynamodb_table" "actions_log" {
  name         = "${local.prefix}-ActionsLog"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "actionId"

  attribute {
    name = "actionId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "timestamp"
    type = "S"
  }

  tags = {
    Project = "Zafira"
  }

  global_secondary_index {
    name            = "GSI-userActions"
    hash_key        = "userId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }
}
