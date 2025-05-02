/**
 * Lambda: Update message record (classification, inputType, originalContent, usedAI)
 * Runtime: AWS Node.js 18.x
 */

const {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');

const REGION       = process.env.AWS_REGION || 'us-east-1';
const DYNAMO_TABLE = process.env.DYNAMO_TABLE;

if (!DYNAMO_TABLE) {
  throw new Error('Environment variable DYNAMO_TABLE must be defined.');
}

const dynamo = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    /* ---------- Validaciones básicas ---------- */
    const messageId = event?.pathParameters?.messageId;
    if (!messageId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing path parameter messageId' }) };
    }

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Empty request body' }) };
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { userId, ...payload } = body;
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };
    }

    /* ---------- Campos permitidos ---------- */
    const allowed = {
      classification: 'S',
      inputType:      'S',
      originalContent:'S',
      usedAI:         'BOOL',   // boolean
    };

    /* ---------- Construir UpdateExpression dinámico ---------- */
    const setParts = [];
    const exprAttrValues = {};

    Object.entries(payload).forEach(([key, value]) => {
      if (allowed[key] !== undefined && value !== undefined) {
        const placeholder = `:${key}`;
        setParts.push(`${key} = ${placeholder}`);
        exprAttrValues[placeholder] =
          allowed[key] === 'BOOL' ? { BOOL: Boolean(value) } : { S: String(value) };
      }
    });

    // Agrega/actualiza lastUpdated con el timestamp actual
    const nowIso = new Date().toISOString();
    setParts.push('lastUpdated = :lu');
    exprAttrValues[':lu'] = { S: nowIso };

    if (setParts.length === 1) {          // solo lastUpdated => nada que cambiar
      return { statusCode: 400, body: JSON.stringify({ error: 'No updatable fields supplied' }) };
    }

    const updateExpression = `SET ${setParts.join(', ')}`;

    /* ---------- 1. Obtener el registro ---------- */
    const queryRes = await dynamo.send(
      new QueryCommand({
        TableName: DYNAMO_TABLE,
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': { S: userId } },
      }),
    );

    const items = queryRes.Items ?? [];
    const item  = items.find((i) => i.messageId?.S === messageId);

    if (!item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Message not found' }) };
    }

    const timestamp = item.timestamp.S;   // sort key permanece intacto

    /* ---------- 2. Ejecutar UpdateItem ---------- */
    await dynamo.send(
      new UpdateItemCommand({
        TableName: DYNAMO_TABLE,
        Key: {
          userId:   { S: userId },
          timestamp:{ S: timestamp },
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: exprAttrValues,
      }),
    );

    /* ---------- 3. Respuesta ---------- */
    return { statusCode: 200, body: JSON.stringify({ message: 'Updated' }) };
  } catch (err) {
    console.error('Error updating message:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
