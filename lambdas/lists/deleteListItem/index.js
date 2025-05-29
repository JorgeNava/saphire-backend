/**
 * Lambda — deleteListItem
 * CURL example:
 * curl -X DELETE https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}/items/{itemId}
 */

const AWS = require('aws-sdk');
const docClient  = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { listId, itemId } = event.pathParameters;

    if (!listId || !itemId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Se requieren listId e itemId en la ruta." })
      };
    }

    // 1) Obtenemos la lista actual
    const { Item } = await docClient.get({
      TableName: TABLE_NAME,
      Key: { listId }
    }).promise();

    if (!Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Lista ${listId} no encontrada.` })
      };
    }

    // 2) Filtramos el ítem a eliminar
    const newItems = (Item.items || []).filter(i => i.itemId !== itemId);
    const now      = new Date().toISOString();

    // 3) Actualizamos el array completo usando alias para 'items'
    const params = {
      TableName: TABLE_NAME,
      Key:       { listId },
      UpdateExpression: 'SET #it = :items, updatedAt = :u',
      ExpressionAttributeNames: {
        '#it': 'items'
      },
      ExpressionAttributeValues: {
        ':items': newItems,
        ':u'    : now
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await docClient.update(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error("deleteListItem error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al eliminar el ítem de la lista." })
    };
  }
};
