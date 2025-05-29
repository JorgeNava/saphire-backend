/**
 * Lambda — addItemToList
 * (equivalente a “createListItem”)
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}/items \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "item":"Nueva tarea pendiente"
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient   = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME  = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { listId } = event.pathParameters;
    const { item }   = JSON.parse(event.body);

    if (!listId || !item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Se requiere listId y item en el cuerpo." })
      };
    }

    const itemObj = { itemId: uuidv4(), content: item };
    const now     = new Date().toISOString();

    const params = {
      TableName: TABLE_NAME,
      Key:       { listId },

      // Usamos placeholder #items para evitar palabra reservada
      UpdateExpression: [
        'SET #items        = list_append(if_not_exists(#items, :empty), :i)',
        ', updatedAt       = :u'
      ].join(''),

      ExpressionAttributeNames: {
        '#items': 'items'
      },

      ExpressionAttributeValues: {
        ':i'     : [ itemObj ],
        ':empty' : [],
        ':u'     : now
      },

      ReturnValues: 'ALL_NEW'
    };

    const result = await docClient.update(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(result.Attributes)
    };

  } catch (error) {
    console.error("addItemToList error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al añadir el ítem a la lista." })
    };
  }
};
