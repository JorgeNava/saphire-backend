/**
 * Lambda — deleteList
 * DELETE /lists/{listId}
 * 
 * Soporta dos formatos:
 * 1. Path parameter: DELETE /lists/{listId}?userId=user123
 * 2. Body (legacy): DELETE /lists con body {"userId":"user123","listId":"uuid"}
 * 
 * CURL examples:
 * curl -X DELETE "https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}?userId=user123"
 * curl -X DELETE "https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}" \
 *   -H "Content-Type: application/json" \
 *   -d '{"userId":"user123"}'
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    // Soportar ambos formatos: path parameter y body
    let listId, userId;
    
    // Formato 1: Path parameter (REST estándar)
    if (event.pathParameters && event.pathParameters.listId) {
      listId = event.pathParameters.listId;
      // userId puede venir en query string o body
      userId = event.queryStringParameters?.userId;
      if (!userId && event.body) {
        const body = JSON.parse(event.body);
        userId = body.userId;
      }
    }
    // Formato 2: Body (compatibilidad con frontend legacy)
    else if (event.body) {
      const body = JSON.parse(event.body);
      listId = body.listId;
      userId = body.userId;
    }

    if (!listId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'listId es requerido (path parameter o body)' })
      };
    }

    // Si se proporciona userId, verificar ownership
    if (userId) {
      const getResult = await docClient.get({
        TableName: TABLE_NAME,
        Key: { listId }
      }).promise();

      const list = getResult.Item;

      if (!list) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Lista no encontrada' })
        };
      }

      // Verificar ownership
      if (list.userId !== userId) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No tienes permiso para eliminar esta lista' })
        };
      }
    }

    // Eliminar la lista
    await docClient.delete({
      TableName: TABLE_NAME,
      Key: { listId }
    }).promise();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Lista eliminada correctamente',
        listId 
      })
    };

  } catch (error) {
    console.error('deleteList error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Error al eliminar la lista',
        details: error.message
      })
    };
  }
};
