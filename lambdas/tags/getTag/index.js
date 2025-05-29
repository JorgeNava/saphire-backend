/**
 * Lambda — getTag
 * CURL example:
 * curl -X GET https://{api-id}.execute-api.{region}.amazonaws.com/tags/{tagId}
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

    const res = await docClient.get({
      TableName: TABLE_NAME,
      Key: { tagId }
    }).promise();

    if (!res.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Etiqueta no encontrada.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(res.Item)
    };
  } catch (err) {
    console.error('getTag error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al obtener la etiqueta.' })
    };
  }
};
