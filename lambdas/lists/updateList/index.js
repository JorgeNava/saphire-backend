/**
 * Lambda — updateList
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "name":"Nombre actualizado",
 *     "items":["itemA","itemB"],
 *     "tagIds":["tagX"],
 *     "tagSource":"IA"
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient  = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { listId } = event.pathParameters;
    const {
      name,
      items = [],
      tagIds = [],
      tagSource
    } = JSON.parse(event.body);

    if (!listId || !name || !tagSource) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Los campos listId, name y tagSource son requeridos."
        })
      };
    }

    const updatedAt = new Date().toISOString();

    // Estandarizamos los items: si vienen como strings, les asignamos un itemId nuevo
    const structuredItems = items.map(i =>
      typeof i === 'string'
        ? { itemId: uuidv4(), content: i }
        : { itemId: i.itemId || uuidv4(), content: i.content }
    );

    const params = {
      TableName: TABLE_NAME,
      Key:       { listId },

      // Usamos alias porque "items" es palabra reservada en DynamoDB UpdateExpression
      UpdateExpression: [
        'SET #n      = :name',
        ', #it      = :items',
        ', tagIds   = :tagIds',
        ', tagSource= :ts',
        ', updatedAt= :u',
        ', lastModifiedBy = :ts'
      ].join(' '),

      ExpressionAttributeNames: {
        '#n' : 'name',
        '#it': 'items'
      },

      ExpressionAttributeValues: {
        ':name': name,
        ':items': structuredItems,
        ':tagIds': tagIds,
        ':ts': tagSource,
        ':u': updatedAt
      },

      ReturnValues: 'ALL_NEW'
    };

    const result = await docClient.update(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(result.Attributes)
    };

  } catch (error) {
    console.error("updateList error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al actualizar la lista." })
    };
  }
};
