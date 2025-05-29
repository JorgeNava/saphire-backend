/**
 * Lambda — getNote
 * CURL example:
 * curl -X GET https://{api-id}.execute-api.{region}.amazonaws.com/notes/{noteId}
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

    const res = await docClient.get({
      TableName: TABLE_NAME,
      Key: { noteId }
    }).promise();

    if (!res.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Nota no encontrada.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(res.Item)
    };
  } catch (err) {
    console.error('getNote error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al obtener la nota.' })
    };
  }
};
