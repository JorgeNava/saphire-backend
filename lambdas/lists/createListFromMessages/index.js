const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient();
const MESSAGES_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { userId, conversationId, messageIds, listName, tags } = JSON.parse(event.body);
    
    // 1. Validar input
    if (!userId || !conversationId || !messageIds || !listName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Faltan parámetros requeridos',
          required: ['userId', 'conversationId', 'messageIds', 'listName']
        })
      };
    }
    
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'messageIds debe ser un array no vacío' })
      };
    }
    
    if (messageIds.length > 50) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'TOO_MANY_MESSAGES',
          message: 'Máximo 50 mensajes permitidos',
          provided: messageIds.length,
          limit: 50
        })
      };
    }
    
    // 2. Obtener mensajes de DynamoDB
    const messages = await getMessages(conversationId, messageIds);
    
    if (messages.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No se encontraron mensajes' })
      };
    }
    
    if (messages.length !== messageIds.length) {
      const foundIds = messages.map(m => m.timestamp);
      const missingIds = messageIds.filter(id => !foundIds.includes(id));
      
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'MESSAGE_NOT_FOUND',
          message: 'Algunos mensajes no fueron encontrados',
          missingIds
        })
      };
    }
    
    // 3. Validar que los mensajes pertenecen a la conversación
    const invalidMessages = messages.filter(m => m.conversationId !== conversationId);
    if (invalidMessages.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Algunos mensajes no pertenecen a la conversación especificada'
        })
      };
    }
    
    // 4. Crear items de lista
    const items = createItemsFromMessages(messages);
    
    // 5. Resolver tags
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
    
    // 6. Crear lista
    const listId = uuidv4();
    const now = new Date().toISOString();
    
    const list = {
      listId,
      userId,
      name: listName,
      items,
      tagIds,
      tagNames,
      tagSource,
      sourceType: 'messages',
      conversationId,
      createdFromMessages: true,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      lastModifiedBy: userId
    };
    
    // 7. Guardar en DynamoDB
    await docClient.put({
      TableName: LISTS_TABLE,
      Item: list
    }).promise();
    
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list)
    };
    
  } catch (err) {
    console.error('Error creating list from messages:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Error al crear lista desde mensajes',
        details: err.message
      })
    };
  }
};

async function getMessages(conversationId, messageIds) {
  try {
    // Obtener mensajes usando Query para cada timestamp
    const promises = messageIds.map(timestamp => 
      docClient.get({
        TableName: MESSAGES_TABLE,
        Key: { conversationId, timestamp }
      }).promise()
    );
    
    const results = await Promise.all(promises);
    return results
      .filter(result => result.Item)
      .map(result => result.Item);
      
  } catch (err) {
    console.error('Error fetching messages:', err);
    throw err;
  }
}

function createItemsFromMessages(messages) {
  // Ordenar mensajes por timestamp
  const sortedMessages = messages.sort((a, b) => 
    a.timestamp.localeCompare(b.timestamp)
  );
  
  return sortedMessages.map((msg, index) => ({
    itemId: uuidv4(),
    content: msg.content,
    completed: false,
    completedAt: null,
    order: index,
    sourceMessageId: msg.timestamp,
    sourceMessageTimestamp: msg.timestamp,
    sourceMessageSender: msg.sender
  }));
}
