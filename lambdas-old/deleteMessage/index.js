/**
 * Lambda: Delete message record + audio file
 * Runtime: AWS Node.js 18.x
 */

const { DynamoDBClient, DeleteItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'us-east-1';
const DYNAMO_TABLE  = process.env.DYNAMO_TABLE;
const AUDIO_BUCKET  = process.env.AUDIO_BUCKET;

if (!DYNAMO_TABLE || !AUDIO_BUCKET) {
  // Falla rápido si faltan variables de entorno esenciales
  throw new Error('Environment variables DYNAMO_TABLE and AUDIO_BUCKET must be defined.');
}

const dynamo = new DynamoDBClient({ region: REGION });
const s3     = new S3Client({ region: REGION });

exports.handler = async (event) => {
  try {
    const messageId = event?.pathParameters?.messageId;
    const userId    = event?.queryStringParameters?.userId;

    if (!messageId || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing messageId or userId' }) };
    }

    // 1. Buscar el mensaje del usuario
    const queryRes = await dynamo.send(new QueryCommand({
      TableName: DYNAMO_TABLE,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': { S: userId } }
    }));

    const items = queryRes.Items ?? [];
    const item  = items.find(i => i.messageId?.S === messageId);

    if (!item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Message not found' }) };
    }

    // 2. Borrar registro en DynamoDB
    await dynamo.send(new DeleteItemCommand({
      TableName: DYNAMO_TABLE,
      Key: {
        userId:   { S: userId },
        timestamp:{ S: item.timestamp.S }
      }
    }));

    // 3. Si es audio, borrar archivo en S3
    if (item.inputType?.S === 'audio' && item.originalContent?.S) {
      const { pathname } = new URL(item.originalContent.S);
      const s3Key = decodeURIComponent(pathname.replace(/^\//, ''));

      await s3.send(new DeleteObjectCommand({
        Bucket: AUDIO_BUCKET,
        Key:    s3Key
      }));
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Deleted' }) };
  } catch (err) {
    console.error('Error deleting message:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
