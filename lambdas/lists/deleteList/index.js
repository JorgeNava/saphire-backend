/**
 * Lambda — deleteList
 * CURL example:
 * curl -X DELETE https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}
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

    await docClient.delete({
      TableName: TABLE_NAME,
      Key: { listId }
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Lista ${listId} eliminada correctamente.` })
    };
  } catch (error) {
    console.error("deleteList error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al eliminar la lista." })
    };
  }
};
