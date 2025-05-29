/**
 * Lambda — getMessage
 * CURL example:
 * curl -X GET https://{api-id}.execute-api.{region}.amazonaws.com/messages/{conversationId}/{timestamp}
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;

exports.handler = async (event) => {
  try {
    const { conversationId, timestamp } = event.pathParameters;
    if (!conversationId || !timestamp) {
      return { statusCode:400,
        body: JSON.stringify({ error:'conversationId y timestamp son requeridos.' }) };
    }

    const res = await docClient.get({
      TableName: MSG_TABLE,
      Key: { conversationId, timestamp }
    }).promise();

    if (!res.Item) {
      return { statusCode:404,
        body: JSON.stringify({ error:'Mensaje no encontrado.' }) };
    }

    return { statusCode:200, body: JSON.stringify(res.Item) };
  } catch (err) {
    console.error(err);
    return { statusCode:500,
      body: JSON.stringify({ error:'Error al obtener mensaje.' }) };
  }
};
