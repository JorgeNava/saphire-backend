/**
 * Lambda — createNoteFromList
 * POST /notes/from-list
 * 
 * Convierte una lista en una nota preservando contexto.
 * Cada item de la lista se convierte en una línea con bullet point.
 * 
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/notes/from-list \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "listId":"list-789",
 *     "title":"Mi lista convertida",
 *     "preserveList":true,
 *     "formatAsBullets":true
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;
const NOTES_TABLE = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { 
      userId, 
      listId, 
      title, 
      preserveList = true, 
      formatAsBullets = true,
      tags 
    } = JSON.parse(event.body);

    // 1. Validar input
    if (!userId || !listId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'userId y listId son requeridos'
        })
      };
    }

    // 2. Obtener lista
    const result = await docClient.get({
      TableName: LISTS_TABLE,
      Key: { listId }
    }).promise();

    const list = result.Item;

    if (!list) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'LIST_NOT_FOUND',
          message: 'Lista no encontrada'
        })
      };
    }

    // Verificar ownership
    if (list.userId !== userId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'UNAUTHORIZED',
          message: 'No tienes permiso para acceder a esta lista'
        })
      };
    }

    // 3. Generar título si no se proporciona
    const finalTitle = title && title.trim() 
      ? title.trim() 
      : list.name;

    // 4. Formatear contenido de la lista
    let content = '';
    if (list.items && Array.isArray(list.items) && list.items.length > 0) {
      content = list.items.map(item => {
        const itemContent = typeof item === 'string' ? item : item.content;
        return formatAsBullets ? `• ${itemContent}` : itemContent;
      }).join('\n');
    } else {
      content = list.name; // Si no hay items, usar el nombre de la lista
    }

    // 5. Resolver tags (combinar tags de la lista + nuevos)
    const allTags = new Set();
    
    if (list.tagNames && Array.isArray(list.tagNames)) {
      list.tagNames.forEach(tag => allTags.add(tag));
    }
    
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => allTags.add(tag));
    }

    const { tagIds, tagNames } = await tagService.parseAndResolveTags(
      Array.from(allTags), 
      userId
    );

    // 6. Crear nota
    const noteId = uuidv4();
    const timestamp = new Date().toISOString();

    const newNote = {
      noteId,
      userId,
      title: finalTitle,
      content,
      attachmentKeys: [],
      tagIds,
      tagNames,
      tagSource: 'Manual',
      sourceType: 'list',
      sourceListId: list.listId,
      sourceListCreatedAt: list.createdAt,
      createdFromList: true,
      listItemCount: list.items?.length || 0,
      createdAt: timestamp,
      createdBy: userId,
      updatedAt: timestamp,
      lastModifiedBy: userId
    };

    // 7. Guardar nota
    await docClient.put({
      TableName: NOTES_TABLE,
      Item: newNote
    }).promise();

    // 8. Eliminar lista si preserveList = false
    if (!preserveList) {
      await docClient.delete({
        TableName: LISTS_TABLE,
        Key: { listId }
      }).promise();
      console.log(`Lista ${listId} eliminada después de conversión a nota`);
    }

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newNote,
        listDeleted: !preserveList
      })
    };

  } catch (error) {
    console.error('createNoteFromList error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al crear la nota desde lista.' })
    };
  }
};
