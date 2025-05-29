/**
 * Lambda — getThought
 * CURL example:
 * curl -X GET https://{api-id}.execute-api.{region}.amazonaws.com/thoughts/{thoughtId}
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

    const res = await docClient.get({
      TableName: THOUGHTS_TBL,
      Key: { thoughtId }
    }).promise();

    if (!res.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Thought no encontrado.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(res.Item)
    };
  } catch (err) {
    console.error('getThought error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al obtener el thought.' })
    };
  }
};
