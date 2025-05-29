/**
 * Lambda — getMessages
 * CURL example:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/messages?conversationId=conv123"
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;

exports.handler = async (event) => {
  try {
    const { conversationId } = event.queryStringParameters || {};
    if (!conversationId) {
      return { statusCode:400,
        body: JSON.stringify({ error:'El query param conversationId es requerido.' }) };
    }

    const res = await docClient.query({
      TableName: MSG_TABLE,
      KeyConditionExpression: 'conversationId = :c',
      ExpressionAttributeValues: { ':c': conversationId },
      ScanIndexForward: true   // orden ascendente por timestamp
    }).promise();

    return { statusCode:200, body: JSON.stringify(res.Items || []) };
  } catch (err) {
    console.error(err);
    return { statusCode:500,
      body: JSON.stringify({ error:'Error al listar mensajes.' }) };
  }
};
