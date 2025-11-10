const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient();
const MESSAGES_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const NOTES_TABLE = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { userId, conversationId, messageId, title, tags } = JSON.parse(event.body);
    
    // 1. Validar input
    if (!userId || !conversationId || !messageId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Faltan parámetros requeridos',
          required: ['userId', 'conversationId', 'messageId']
        })
      };
    }
    
    // 2. Obtener mensaje de DynamoDB
    const message = await getMessage(conversationId, messageId);
    
    if (!message) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'MESSAGE_NOT_FOUND',
          message: 'Mensaje no encontrado'
        })
      };
    }
    
    // 3. Validar que el mensaje pertenece a la conversación
    if (message.conversationId !== conversationId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'El mensaje no pertenece a la conversación especificada'
        })
      };
    }
    
    // 4. Validar longitud del contenido
    if (message.content && message.content.length > 5000) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'El contenido del mensaje excede el límite de 5000 caracteres',
          length: message.content.length,
          limit: 5000
        })
      };
    }
    
    // 5. Generar título
    const noteTitle = title || generateSimpleTitle(message.content);
    
    // 6. Resolver tags
    let tagIds = [];
    let tagNames = [];
    let tagSource = null;
    
    if (tags && tags.length > 0) {
      const tagService = new TagService();
      const resolved = await tagService.parseAndResolveTags(tags, userId);
      tagIds = resolved.tagIds;
      tagNames = resolved.tagNames;
      tagSource = 'Manual';
    }
    
    // 7. Crear nota
    const noteId = uuidv4();
    const now = new Date().toISOString();
    
    const note = {
      noteId,
      userId,
      title: noteTitle,
      content: message.content,
      attachmentKeys: [],
      tagIds,
      tagNames,
      tagSource,
      sourceType: 'message',
      sourceMessageId: messageId,
      sourceConversationId: conversationId,
      sourceMessageTimestamp: message.timestamp,
      sourceMessageSender: message.sender,
      createdFromMessage: true,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      lastModifiedBy: userId
    };
    
    // 8. Guardar en DynamoDB
    await docClient.put({
      TableName: NOTES_TABLE,
      Item: note
    }).promise();
    
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note)
    };
    
  } catch (err) {
    console.error('Error creating note from message:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Error al crear nota desde mensaje',
        details: err.message
      })
    };
  }
};

async function getMessage(conversationId, messageId) {
  try {
    const result = await docClient.get({
      TableName: MESSAGES_TABLE,
      Key: { conversationId, timestamp: messageId }
    }).promise();
    
    return result.Item;
  } catch (err) {
    console.error('Error fetching message:', err);
    throw err;
  }
}

function generateSimpleTitle(content) {
  if (!content) {
    return 'Nota sin título';
  }
  
  const maxLength = 50;
  const title = content.length > maxLength 
    ? content.substring(0, maxLength).trim() + '...'
    : content.trim();
  
  return title;
}
