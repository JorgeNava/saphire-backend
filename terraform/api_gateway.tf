# terraform/api_gateway.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

#################################################################
# 1. HTTP API
#################################################################
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.table_prefix}-HTTP-API"
  protocol_type = "HTTP"
}

#################################################################
# 2. Integraciones Lambda (AWS_PROXY)
#################################################################
# Mapea cada Lambda definida en aws_lambda_function.<nombre>  
# a una integración de API Gateway
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = {
    saveTextMessage    = aws_lambda_function.saveTextMessage.arn
    saveAudioMessage   = aws_lambda_function.saveAudioMessage.arn
    generateUploadUrl  = aws_lambda_function.generateUploadUrl.arn
    getMessages        = aws_lambda_function.getMessages.arn
    getMessage         = aws_lambda_function.getMessage.arn
    updateMessage      = aws_lambda_function.updateMessage.arn
    deleteMessage      = aws_lambda_function.deleteMessage.arn
    createList         = aws_lambda_function.createList.arn
    getLists           = aws_lambda_function.getLists.arn
    addItemToList      = aws_lambda_function.addItemToList.arn
    deleteList         = aws_lambda_function.deleteList.arn
    deleteListItem     = aws_lambda_function.deleteListItem.arn
    replaceListItems   = aws_lambda_function.replaceListItems.arn
    createThought      = aws_lambda_function.createThought.arn
    getThoughts        = aws_lambda_function.getThoughts.arn
    getThought         = aws_lambda_function.getThought.arn
    updateThought      = aws_lambda_function.updateThought.arn
    deleteThought      = aws_lambda_function.deleteThought.arn
    createNote         = aws_lambda_function.createNote.arn
    getNotes           = aws_lambda_function.getNotes.arn
    getNote            = aws_lambda_function.getNote.arn
    updateNote         = aws_lambda_function.updateNote.arn
    deleteNote         = aws_lambda_function.deleteNote.arn
    createTag          = aws_lambda_function.createTag.arn
    getTags            = aws_lambda_function.getTags.arn
    getTag             = aws_lambda_function.getTag.arn
    updateTag          = aws_lambda_function.updateTag.arn
    deleteTag          = aws_lambda_function.deleteTag.arn
    recordAction       = aws_lambda_function.recordAction.arn
    getActions         = aws_lambda_function.getActions.arn
    createUser         = aws_lambda_function.createUser.arn
    getUser            = aws_lambda_function.getUser.arn
    updateUser         = aws_lambda_function.updateUser.arn
  }

  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value
  integration_method     = "POST"
  payload_format_version = "2.0"
}

#################################################################
# 3. Rutas
#################################################################
locals {
  routes = {
    saveTextMessage   = { method = "POST" , path = "/messages/text"       }
    saveAudioMessage  = { method = "POST" , path = "/messages/audio"      }
    generateUploadUrl = { method = "POST" , path = "/messages/upload-url" }
    getMessages       = { method = "GET"  , path = "/messages"           }
    getMessage        = { method = "GET"  , path = "/messages/{messageId}"}
    updateMessage     = { method = "PUT"  , path = "/messages/{messageId}"}
    deleteMessage     = { method = "DELETE", path = "/messages/{messageId}"}
    createList        = { method = "POST" , path = "/lists"              }
    getLists          = { method = "GET"  , path = "/lists"              }
    addItemToList     = { method = "POST" , path = "/lists/{listId}/items"}
    deleteListItem    = { method = "DELETE", path = "/lists/{listId}/items/{item}"}
    replaceListItems  = { method = "PUT"  , path = "/lists/{listId}/items"}
    deleteList        = { method = "DELETE", path = "/lists/{listId}"     }
    createThought     = { method = "POST" , path = "/thoughts"           }
    getThoughts       = { method = "GET"  , path = "/thoughts"           }
    getThought        = { method = "GET"  , path = "/thoughts/{thoughtId}"}
    updateThought     = { method = "PUT"  , path = "/thoughts/{thoughtId}"}
    deleteThought     = { method = "DELETE", path = "/thoughts/{thoughtId}"}
    createNote        = { method = "POST" , path = "/notes"              }
    getNotes          = { method = "GET"  , path = "/notes"              }
    getNote           = { method = "GET"  , path = "/notes/{noteId}"     }
    updateNote        = { method = "PUT"  , path = "/notes/{noteId}"     }
    deleteNote        = { method = "DELETE", path = "/notes/{noteId}"    }
    createTag         = { method = "POST" , path = "/tags"               }
    getTags           = { method = "GET"  , path = "/tags"               }
    getTag            = { method = "GET"  , path = "/tags/{tagId}"       }
    updateTag         = { method = "PUT"  , path = "/tags/{tagId}"       }
    deleteTag         = { method = "DELETE", path = "/tags/{tagId}"      }
    recordAction      = { method = "POST" , path = "/actions"            }
    getActions        = { method = "GET"  , path = "/actions"            }
    createUser        = { method = "POST" , path = "/users"              }
    getUser           = { method = "GET"  , path = "/users/{userId}"     }
    updateUser        = { method = "PUT"  , path = "/users/{userId}"     }
  }
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "${each.value.method} ${each.value.path}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.key].id}"
}

#################################################################
# 4. Permisos: autorizar API Gateway a invocar Lambdas
#################################################################
resource "aws_lambda_permission" "apigw_invoke" {
  for_each      = aws_apigatewayv2_integration.lambda

  statement_id  = "AllowInvoke_${each.key}"
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  function_name = aws_lambda_function[each.key].function_name
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
