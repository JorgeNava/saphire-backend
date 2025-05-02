/**
 * Lambda: Update message record (classification, summary, transcription)
 * Runtime: AWS Node.js 18.x
 */

const {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');

const REGION        = process.env.AWS_REGION || 'us-east-1';
const DYNAMO_TABLE  = process.env.DYNAMO_TABLE;

if (!DYNAMO_TABLE) {
  // Falla rápido en tiempo de inicio si falta la tabla
  throw new Error('Environment variable DYNAMO_TABLE must be defined.');
}

const dynamo = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    // --- Validaciones básicas ------------------------------------------------
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

    const {
      userId,
      classification = '',
      summary        = '',
      transcription  = '',
    } = body;

    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };
    }

    // --- 1. Obtener el mensaje ------------------------------------------------
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

    const timestamp = item.timestamp.S;

    // --- 2. Actualizar registro ----------------------------------------------
    await dynamo.send(
      new UpdateItemCommand({
        TableName: DYNAMO_TABLE,
        Key: {
          userId:   { S: userId },
          timestamp:{ S: timestamp },
        },
        UpdateExpression: 'SET classification = :c, summary = :s, transcription = :t',
        ExpressionAttributeValues: {
          ':c': { S: classification },
          ':s': { S: summary },
          ':t': { S: transcription },
        },
      }),
    );

    // --- 3. Respuesta ---------------------------------------------------------
    return { statusCode: 200, body: JSON.stringify({ message: 'Updated' }) };
  } catch (err) {
    console.error('Error updating message:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
