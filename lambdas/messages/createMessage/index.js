/**
 * Lambda — createMessage
 * POST /messages
 * Guarda el mensaje con su intent identificado.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const lambda    = new AWS.Lambda({ region: process.env.AWS_REGION });

const MSG_TABLE     = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const INTENT_LAMBDA = process.env.MESSAGE_INTENT_LAMBDA_NAME;

exports.handler = async (event) => {
  try {
    // 1) Parsear y validar entrada
    const { conversationId, sender, content } = JSON.parse(event.body || '{}');
    if (!conversationId || !sender || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'conversationId, sender y content son requeridos.' })
      };
    }

    // 2) Llamar a la Lambda de identificación de intent de forma síncrona
    const intentRes = await lambda.invoke({
      FunctionName:   INTENT_LAMBDA,
      InvocationType: 'RequestResponse',
      Payload:        JSON.stringify({ sender, content })
    }).promise();

    const { intent } = JSON.parse(intentRes.Payload);

    // 3) Construir y guardar el mensaje en DynamoDB
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const item = {
      conversationId,
      messageId,
      timestamp,
      sender,
      content,
      intent,
      inputType: 'text',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await docClient.put({
      TableName: MSG_TABLE,
      Item:      item
    }).promise();

    // 4) Responder al cliente
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
