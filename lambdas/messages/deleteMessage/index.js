/**
 * Lambda — deleteMessage
 * DELETE /messages/{messageId}
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

    // 1) buscar el item para obtener conversationId y timestamp
    const scanRes = await docClient.scan({
      TableName: MSG_TABLE,
      FilterExpression: 'messageId = :m',
      ExpressionAttributeValues: { ':m': messageId }
    }).promise();

    if (!scanRes.Items || scanRes.Items.length === 0) {
      return { statusCode:404, body: JSON.stringify({ error: 'Mensaje no encontrado.' }) };
    }

    const { conversationId, timestamp } = scanRes.Items[0];

    // 2) borrarlo
    await docClient.delete({
      TableName: MSG_TABLE,
      Key: { conversationId, timestamp }
    }).promise();

    return { statusCode:200, body: JSON.stringify({ message: 'Mensaje eliminado.' }) };
  } catch (err) {
    console.error('deleteMessage error:', err);
    return { statusCode:500, body: JSON.stringify({ error: 'Error al eliminar mensaje.' }) };
  }
};
