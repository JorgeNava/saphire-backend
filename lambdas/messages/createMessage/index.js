/**
 * Lambda — createMessage
 * POST /messages
 * Guarda el mensaje y, si viene de un usuario (sender ≠ "IA"), llama al identificador de intent.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const lambda    = new AWS.Lambda({ region: process.env.AWS_REGION });

const MSG_TABLE     = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const INTENT_LAMBDA = process.env.MESSAGE_INTENT_LAMBDA_NAME;

exports.handler = async (event) => {
  try {
    // 0) Parsear entrada
    const { conversationId, sender, content } = JSON.parse(event.body || '{}');
    if (!conversationId || !sender || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'conversationId, sender y content son requeridos.' })
      };
    }

    // 1) Guardar mensaje inicial (sin intent)
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const baseItem = {
      conversationId,
      timestamp,
      messageId,
      sender,
      content,
      inputType: 'text',
      createdAt: timestamp,
      updatedAt: timestamp,
      intent: null
    };

    await docClient
      .put({
        TableName: MSG_TABLE,
        Item:      baseItem
      })
      .promise();

    // 2) Sólo si no viene de la IA, llamamos al intent-identifier
    if (sender.toLowerCase() !== 'ia') {
      const resp = await lambda
        .invoke({
          FunctionName:   INTENT_LAMBDA,
          InvocationType: 'RequestResponse',
          Payload:        JSON.stringify({ sender, content })
        })
        .promise();

      const { intent } = JSON.parse(resp.Payload);

      // 3) Actualizar únicamente el campo `intent` (y `updatedAt`)
      const now = new Date().toISOString();
      await docClient
        .update({
          TableName: MSG_TABLE,
          Key: {
            conversationId,
            timestamp
          },
          UpdateExpression:       'SET intent = :i, updatedAt = :u',
          ExpressionAttributeValues: {
            ':i': intent,
            ':u': now
          },
          ReturnValues: 'ALL_NEW'
        })
        .promise();

      baseItem.intent    = intent;
      baseItem.updatedAt = now;
    }

    // 4) Devolver al cliente el item completo
    return {
      statusCode: 201,
      body: JSON.stringify(baseItem)
    };

  } catch (err) {
    console.error('createMessage error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear el mensaje.' })
    };
  }
};
