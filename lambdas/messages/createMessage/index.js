/**
 * Lambda — createMessage
 * POST /messages
 * Guarda el mensaje y, si viene de un usuario (sender ≠ "IA"), llama al identificador de intent.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const lambda    = new AWS.Lambda({ region: process.env.AWS_REGION });
const tagService = new TagService();

const MSG_TABLE     = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const INTENT_LAMBDA = process.env.LAMBDA_NAME_MESSAGE_INTENT_IDENTIFICATION;

exports.handler = async (event) => {
  try {
    // 0) Parsear entrada
    const body = JSON.parse(event.body || '{}');
    const conversationId = body.conversationId || body.userId; // Aceptar userId como conversationId
    const { sender, content, tags, tagNames: inputTagNames, inputType } = body;
    
    // Log para debugging
    console.log('createMessage - conversationId:', conversationId, 'sender:', sender, 'content length:', content?.length);
    
    if (!conversationId || !sender || !content) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'conversationId (o userId), sender y content son requeridos.' })
      };
    }

    // Resolver tags si se proporcionan (usar tags o tagNames del input)
    const tagsToResolve = tags || inputTagNames;
    const { tagIds, tagNames } = await tagService.parseAndResolveTags(tagsToResolve, sender);

    // 1) Guardar mensaje inicial (sin intent)
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const baseItem = {
      conversationId,
      timestamp,
      messageId,
      sender,
      content,
      inputType: inputType || 'text',
      tagIds,
      tagNames,
      tagSource: tags || inputTagNames ? 'Manual' : null,
      createdAt: timestamp,
      updatedAt: timestamp,
      intent: null
    };

    console.log('createMessage - Guardando mensaje:', { conversationId, messageId, timestamp });

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
          Payload:        JSON.stringify({ 
            sender, 
            content,
            conversationId,
            timestamp,
            tagIds,
            tagNames,
            tagSource: baseItem.tagSource
          })
        })
        .promise();

      const payload = JSON.parse(resp.Payload);
      const body    = JSON.parse(payload.body || '{}');
      const intent  = body.intent || 'thought';
      
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
    console.log('createMessage - Mensaje guardado exitosamente:', messageId);
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseItem)
    };

  } catch (err) {
    console.error('createMessage error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Error al crear el mensaje.',
        details: err.message 
      })
    };
  }
};
