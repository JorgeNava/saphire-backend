/**
 * Lambda — getMessage
 * GET /messages/{messageId}
 */
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;

exports.handler = async (event) => {
  try {
    const { messageId } = event.pathParameters;
    if (!messageId) {
      return { statusCode:400, body: JSON.stringify({ error: 'messageId es requerido.' }) };
    }

    const scanRes = await docClient.scan({
      TableName: MSG_TABLE,
      FilterExpression: 'messageId = :m',
      ExpressionAttributeValues: { ':m': messageId }
    }).promise();

    if (!scanRes.Items || scanRes.Items.length === 0) {
      return { statusCode:404, body: JSON.stringify({ error: 'Mensaje no encontrado.' }) };
    }

    return { statusCode:200, body: JSON.stringify(scanRes.Items[0]) };
  } catch (err) {
    console.error('getMessage error:', err);
    return { statusCode:500, body: JSON.stringify({ error: 'Error al obtener mensaje.' }) };
  }
};
