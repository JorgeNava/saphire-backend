// api_gateway.tf
// HTTP API Gateway v2 + Integraciones a las Lambdas

locals {
  # Map de rutas y métodos de tu API
  lambda_routes = {
    saveTextMessage   = { method = "POST",   path = "/messages/text" }
    saveAudioMessage  = { method = "POST",   path = "/messages/audio" }
    generateUploadUrl = { method = "GET",    path = "/messages/upload-url" }
    getMessages       = { method = "GET",    path = "/messages" }
    getMessage        = { method = "GET",    path = "/messages/{conversationId}/{timestamp}" }
    updateMessage     = { method = "PUT",    path = "/messages/{conversationId}/{timestamp}" }
    deleteMessage     = { method = "DELETE", path = "/messages/{conversationId}/{timestamp}" }

    createList        = { method = "POST",   path = "/lists" }
    getLists          = { method = "GET",    path = "/lists" }
    getList           = { method = "GET",    path = "/lists/{listId}" }
    updateList        = { method = "PUT",    path = "/lists/{listId}" }
    deleteList        = { method = "DELETE", path = "/lists/{listId}" }
    addItemToList     = { method = "POST",   path = "/lists/{listId}/items" }
    deleteListItem    = { method = "DELETE", path = "/lists/{listId}/items/{itemId}" }
    replaceListItems  = { method = "PUT",    path = "/lists/{listId}/items" }

    createThought     = { method = "POST",   path = "/thoughts" }
    getThoughts       = { method = "GET",    path = "/thoughts" }
    getThought        = { method = "GET",    path = "/thoughts/{thoughtId}" }
    updateThought     = { method = "PUT",    path = "/thoughts/{thoughtId}" }
    deleteThought     = { method = "DELETE", path = "/thoughts/{thoughtId}" }

    createNote        = { method = "POST",   path = "/notes" }
    getNotes          = { method = "GET",    path = "/notes" }
    getNote           = { method = "GET",    path = "/notes/{noteId}" }
    updateNote        = { method = "PUT",    path = "/notes/{noteId}" }
    deleteNote        = { method = "DELETE", path = "/notes/{noteId}" }

    createTag         = { method = "POST",   path = "/tags" }
    getTags           = { method = "GET",    path = "/tags" }
    getTag            = { method = "GET",    path = "/tags/{tagId}" }
    updateTag         = { method = "PUT",    path = "/tags/{tagId}" }
    deleteTag         = { method = "DELETE", path = "/tags/{tagId}" }

    recordAction      = { method = "POST",   path = "/actions" }
    getActions        = { method = "GET",    path = "/actions" }

    createUser        = { method = "POST",   path = "/users" }
    getUser           = { method = "GET",    path = "/users/{userId}" }
    updateUser        = { method = "PUT",    path = "/users/{userId}" }
  }
}

# 1) Definimos el HTTP API
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.table_prefix}-Backend-Gateway"
  description   = "API Gateway for Zafira Backend"
  protocol_type = "HTTP"
  tags = {
    Project = "Zafira"
  }
}

# 2) Creamos una integración AWS_PROXY POR CADA Lambda  
#    Usamos aws_lambda_function.all[<clave>] que debe coincidir con local.lambda_routes
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = aws_lambda_function.all

  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  payload_format_version = "2.0"
  integration_uri        = each.value.arn
}

# 3) Creamos cada ruta a partir de local.lambda_routes, apuntando a la integración correcta
resource "aws_apigatewayv2_route" "routes" {
  for_each = aws_apigatewayv2_integration.lambda

  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "${local.lambda_routes[each.key].method} ${local.lambda_routes[each.key].path}"
  target    = "integrations/${each.value.id}"
}

# 4) Stage por defecto con despliegue automático
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# 5) Permisos para que API Gateway invoque cada Lambda
resource "aws_lambda_permission" "apigw_invoke" {
  for_each     = aws_lambda_function.all

  statement_id  = "AllowInvoke_${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/${local.lambda_routes[each.key].method}"
}
