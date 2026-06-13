###############################################################################
# export_to_vault.tf
# Lambda programada (EventBridge diario) que escribe un roll-up de thoughts/notes
# al vault unificado "Segundo Cerebro" (JorgeNava/segundo-cerebro).
# NO está en local.lambda_functions (no tiene ruta de API Gateway): es standalone.
###############################################################################

resource "aws_lambda_function" "export_to_vault" {
  function_name    = "${local.prefix}-exportToVault"
  filename         = "${var.lambda_zip_dir}/${local.prefix}-exportToVault.zip"
  source_code_hash = filebase64sha256("${var.lambda_zip_dir}/${local.prefix}-exportToVault.zip")
  publish          = true

  handler = "index.handler"
  runtime = "nodejs18.x"
  role    = aws_iam_role.lambda_exec.arn
  # Sin layers: usa @aws-sdk v3 (incluido en el runtime nodejs18) + fetch global.

  timeout     = 60
  memory_size = 256

  environment {
    variables = {
      AWS_DYNAMODB_TABLE_THOUGHTS = var.aws_dynamodb_table_thoughts
      AWS_DYNAMODB_TABLE_NOTES    = var.aws_dynamodb_table_notes
      GITHUB_ACCESS_TOKEN         = var.github_access_token
      GITHUB_REPO                 = var.github_repo
      GITHUB_BRANCH               = var.github_branch
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_ddb_access,
    aws_iam_role_policy.lambda_logs,
  ]
}

# --- EventBridge: dispara la Lambda una vez al día ---------------------------
resource "aws_cloudwatch_event_rule" "export_to_vault_daily" {
  name                = "${local.prefix}-exportToVault-daily"
  description         = "Roll-up diario de Saphire al vault Segundo Cerebro"
  schedule_expression = "cron(0 9 * * ? *)" # 09:00 UTC ≈ 03:00 CDMX
}

resource "aws_cloudwatch_event_target" "export_to_vault_target" {
  rule      = aws_cloudwatch_event_rule.export_to_vault_daily.name
  target_id = "exportToVault"
  arn       = aws_lambda_function.export_to_vault.arn
}

resource "aws_lambda_permission" "allow_eventbridge_export" {
  statement_id  = "AllowEventBridgeInvokeExportToVault"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.export_to_vault.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.export_to_vault_daily.arn
}
