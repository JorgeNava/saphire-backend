/**
 * Lambda — GET /message/{messageId}
 * Devuelve un único mensaje perteneciente al usuario.
 * Runtime: AWS Node.js 18.x
 */

const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall }                   = require('@aws-sdk/util-dynamodb');

const REGION       = process.env.AWS_REGION || 'us-east-1';
const DYNAMO_TABLE = process.env.DYNAMO_TABLE;

if (!DYNAMO_TABLE) {
  throw new Error('Environment variable DYNAMO_TABLE must be defined.');
}

const dynamo = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    /* ---------- Validaciones ---------- */
    const messageId = event?.pathParameters?.messageId;
    const userId    = event?.queryStringParameters?.userId;   // PK de la tabla

    if (!messageId || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing messageId or userId' }),
      };
    }

    /* ---------- 1. Consultar mensajes del usuario ---------- */
    const queryRes = await dynamo.send(
      new QueryCommand({
        TableName: DYNAMO_TABLE,
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': { S: userId } },
      }),
    );

    /* ---------- 2. Buscar el mensaje solicitado ---------- */
    const items = queryRes.Items ?? [];
    const item  = items.find((i) => i.messageId?.S === messageId);

    if (!item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Message not found' }) };
    }

    /* ---------- 3. Devolver el mensaje en JSON plano ---------- */
    const data = unmarshall(item);
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    console.error('Error getting message:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
