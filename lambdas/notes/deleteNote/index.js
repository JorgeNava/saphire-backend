/**
 * Lambda — deleteNote
 * CURL example:
 * curl -X DELETE https://{api-id}.execute-api.{region}.amazonaws.com/notes/{noteId}
 */

const AWS = require('aws-sdk');
const docClient  = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { noteId } = event.pathParameters;
    if (!noteId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El parámetro noteId es requerido.' })
      };
    }

    await docClient.delete({
      TableName: TABLE_NAME,
      Key: { noteId }
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Nota ${noteId} eliminada.` })
    };
  } catch (err) {
    console.error('deleteNote error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al eliminar la nota.' })
    };
  }
};
