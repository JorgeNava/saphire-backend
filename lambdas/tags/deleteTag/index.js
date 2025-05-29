/**
 * Lambda — deleteTag
 * CURL example:
 * curl -X DELETE https://{api-id}.execute-api.{region}.amazonaws.com/tags/{tagId}
 */

const AWS = require('aws-sdk');
const docClient  = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_TAGS;

exports.handler = async (event) => {
  try {
    const { tagId } = event.pathParameters;
    if (!tagId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El parámetro tagId es requerido.' })
      };
    }

    await docClient.delete({
      TableName: TABLE_NAME,
      Key: { tagId }
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Etiqueta ${tagId} eliminada correctamente.` })
    };
  } catch (err) {
    console.error('deleteTag error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al eliminar la etiqueta.' })
    };
  }
};
