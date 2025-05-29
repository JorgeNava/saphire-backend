/**
 * Lambda — deleteThought
 * CURL example:
 * curl -X DELETE https://{api-id}.execute-api.{region}.amazonaws.com/thoughts/{thoughtId}
 */

const AWS = require('aws-sdk');
const docClient    = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;

exports.handler = async (event) => {
  try {
    const { thoughtId } = event.pathParameters;
    if (!thoughtId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El parámetro thoughtId es requerido.' })
      };
    }

    await docClient.delete({
      TableName: THOUGHTS_TBL,
      Key: { thoughtId }
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Thought ${thoughtId} eliminado.` })
    };
  } catch (err) {
    console.error('deleteThought error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al eliminar el thought.' })
    };
  }
};
