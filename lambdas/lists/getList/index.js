/**
 * Lambda — getList
 * CURL example:
 * curl -X GET https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { listId } = event.pathParameters;

    if (!listId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "El parámetro listId es requerido." })
      };
    }

    const result = await docClient.get({
      TableName: TABLE_NAME,
      Key: { listId }
    }).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Lista ${listId} no encontrada.` })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error("getList error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al obtener la lista." })
    };
  }
};
