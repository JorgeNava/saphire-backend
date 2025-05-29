/**
 * Lambda — deleteListItem
 * CURL example:
 * curl -X DELETE \
 *   "https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}/items/{encodeURIComponent(itemContent)}"
 */

const AWS = require('aws-sdk');
const docClient  = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { listId, itemContent } = event.pathParameters;
    const decodedContent = decodeURIComponent(itemContent);

    if (!listId || !decodedContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Se requieren listId y itemContent en la ruta." })
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

    // 2) Filtramos por content en lugar de itemId
    const newItems = (Item.items || []).filter(i => i.content !== decodedContent);

    // 3) Actualizamos el array completo (nombra #items para evitar reserved word)
    const params = {
      TableName: TABLE_NAME,
      Key: { listId },
      UpdateExpression: 'SET #items = :items, updatedAt = :u',
      ExpressionAttributeNames: {
        '#items': 'items'
      },
      ExpressionAttributeValues: {
        ':items': newItems,
        ':u'    : new Date().toISOString()
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
