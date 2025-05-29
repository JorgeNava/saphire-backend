# terraform/api_gateway.tf

#################################################################
# 1. HTTP API
#################################################################
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.table_prefix}-Backend-Gateway"
  description   = "API Gateway for the backend services"
  protocol_type = "HTTP"
}

#################################################################
# 2. Integraciones Lambda (AWS_PROXY) referenciando aws_lambda_function.all
#################################################################
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = aws_lambda_function.all

  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

#################################################################
# 3. Rutas
#################################################################
locals {
  routes = {
    createMessage  = { method = "POST"   , path = "/messages"        }
    createMessageFromAudio  = { method = "POST"   , path = "/messages/audio"        }
    generateMessageAudioUploadUrl = { method = "POST"   , path = "/messages/upload-url"   }
    getMessages       = { method = "GET"    , path = "/messages"             }
    getMessage        = { method = "GET"    , path = "/messages/{messageId}" }
    updateMessage     = { method = "PUT"    , path = "/messages/{messageId}" }
    deleteMessage     = { method = "DELETE" , path = "/messages/{messageId}" }
    createList        = { method = "POST"   , path = "/lists"                }
    getList           = { method = "GET"    , path = "/lists/{listId}"       }
    getLists          = { method = "GET"    , path = "/lists"                }
    addItemToList     = { method = "POST"   , path = "/lists/{listId}/items" }
    updateList        = { method = "PUT"    , path = "/lists/{listId}"       }
    deleteListItem    = { method = "DELETE" , path = "/lists/{listId}/items/{item}" }
    deleteList        = { method = "DELETE" , path = "/lists/{listId}"       }
    createThought     = { method = "POST"   , path = "/thoughts"             }
    getThoughts       = { method = "GET"    , path = "/thoughts"             }
    getThought        = { method = "GET"    , path = "/thoughts/{thoughtId}" }
    updateThought     = { method = "PUT"    , path = "/thoughts/{thoughtId}" }
    deleteThought     = { method = "DELETE" , path = "/thoughts/{thoughtId}" }
    createNote        = { method = "POST"   , path = "/notes"                }
    getNotes          = { method = "GET"    , path = "/notes"                }
    getNote           = { method = "GET"    , path = "/notes/{noteId}"       }
    updateNote        = { method = "PUT"    , path = "/notes/{noteId}"       }
    deleteNote        = { method = "DELETE" , path = "/notes/{noteId}"       }
    createTag         = { method = "POST"   , path = "/tags"                 }
    getTags           = { method = "GET"    , path = "/tags"                 }
    getTag            = { method = "GET"    , path = "/tags/{tagId}"         }
    updateTag         = { method = "PUT"    , path = "/tags/{tagId}"         }
    deleteTag         = { method = "DELETE" , path = "/tags/{tagId}"         }
    recordAction      = { method = "POST"   , path = "/actions"              }
    getActions        = { method = "GET"    , path = "/actions"              }
    createUser        = { method = "POST"   , path = "/users"                }
    getUser           = { method = "GET"    , path = "/users/{userId}"       }
    updateUser        = { method = "PUT"    , path = "/users/{userId}"       }
  }
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "${each.value.method} ${each.value.path}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.key].id}"
}

#################################################################
# 4. Permisos: autorizar API Gateway a invocar todas las Lambdas
#################################################################
resource "aws_lambda_permission" "apigw_invoke" {
  for_each = aws_apigatewayv2_integration.lambda

  statement_id  = "AllowInvoke_${each.key}"
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  function_name = aws_lambda_function.all[each.key].function_name
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

#################################################################
# 5. Stage: crear el stage por defecto para el HTTP API
#################################################################
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"       # the built-in “default” stage
  auto_deploy = true             # pushes your routes/integrations immediately
}
