/**
 * Lambda — createMessage
 * POST /messages
 * Guarda el mensaje y, si viene de un usuario (sender ≠ "IA"), llama al identificador de intent.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const lambda    = new AWS.Lambda({ region: process.env.AWS_REGION });

const MSG_TABLE        = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const INTENT_LAMBDA    = process.env.LAMBDA_NAME_MESSAGE_INTENT_IDENTIFICATION;

exports.handler = async (event) => {
  try {
    const { conversationId, sender, content,  } = JSON.parse(event.body || '{}');
    if (!conversationId || !sender || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'conversationId, sender y content son requeridos.' })
      };
    }

    // 1) Persistir el mensaje básico
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const item = {
      conversationId,
      messageId,
      timestamp,
      sender,
      content,
      inputType:  'text',
      createdAt:  timestamp,
      updatedAt:  timestamp,
      intent:     null
    };
    await docClient.put({ TableName: MSG_TABLE, Item: item }).promise();

    // 2) Solo si no proviene de la IA, invocar identificación de intent
    if (sender.toLowerCase() !== 'ia') {
      const resp = await lambda.invoke({
        FunctionName:   INTENT_LAMBDA,
        InvocationType: 'RequestResponse',
        Payload:        JSON.stringify({ sender, content })
      }).promise();

      const { intent } = JSON.parse(resp.Payload);
      // 3) Actualizar solo el campo intent en el mismo ítem
      await docClient.update({
        TableName: MSG_TABLE,
        Key:       { conversationId, messageId },
        UpdateExpression: 'SET intent = :i, updatedAt = :u',
        ExpressionAttributeValues: {
          ':i': intent,
          ':u': new Date().toISOString()
        }
      }).promise();

      item.intent    = intent;
      item.updatedAt = new Date().toISOString();
    }

    return {
      statusCode: 201,
      body: JSON.stringify(item)
    };

  } catch (err) {
    console.error('createMessage error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear el mensaje.' })
    };
  }
};
