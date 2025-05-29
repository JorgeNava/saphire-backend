/**
 * Lambda — createList
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/lists \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "name":"Mi lista de tareas",
 *     "items":["Comprar leche","Mandar email"],
 *     "tagIds":["tag1","tag2"],
 *     "tagSource":"Manual"
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient  = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const {
      userId,
      name,
      items = [],
      tagIds = [],
      tagSource
    } = JSON.parse(event.body);

    if (!userId || !name || !tagSource) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Los campos userId, name y tagSource son requeridos."
        })
      };
    }

    const listId    = uuidv4();
    const timestamp = new Date().toISOString();

    // Mapeamos cada string a un objeto con itemId + content
    const structuredItems = items.map(content => ({
      itemId:  uuidv4(),
      content
    }));

    const newList = {
      listId,
      userId,
      name,
      items:           structuredItems,
      tagIds,
      tagSource,
      createdAt:       timestamp,
      createdBy:       tagSource,
      updatedAt:       timestamp,
      lastModifiedBy:  tagSource
    };

    await docClient.put({
      TableName: TABLE_NAME,
      Item:      newList
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify(newList)
    };

  } catch (error) {
    console.error("createList error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al crear la lista." })
    };
  }
};
