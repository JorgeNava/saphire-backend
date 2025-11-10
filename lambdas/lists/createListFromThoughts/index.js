/**
 * Lambda — createListFromThoughts
 * POST /lists/from-thoughts
 * 
 * Convierte múltiples pensamientos en items de una lista con referencias bidireccionales.
 * 
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/lists/from-thoughts \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "thoughtIds":["thought-001","thought-002"],
 *     "listName":"Tareas pendientes",
 *     "tags":["trabajo"]
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const THOUGHTS_TABLE = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { userId, thoughtIds, listName, tags } = JSON.parse(event.body);

    // 1. Validar input
    if (!userId || !thoughtIds || !Array.isArray(thoughtIds) || thoughtIds.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'userId y thoughtIds (array no vacío) son requeridos'
        })
      };
    }

    if (!listName || !listName.trim()) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'listName es requerido'
        })
      };
    }

    if (thoughtIds.length > 50) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'TOO_MANY_THOUGHTS',
          message: 'Máximo 50 pensamientos permitidos',
          provided: thoughtIds.length,
          limit: 50
        })
      };
    }

    // 2. Obtener pensamientos usando batchGet
    const keys = thoughtIds.map(id => ({ thoughtId: id, userId }));
    const batchResult = await docClient.batchGet({
      RequestItems: {
        [THOUGHTS_TABLE]: {
          Keys: keys
        }
      }
    }).promise();

    const thoughts = batchResult.Responses[THOUGHTS_TABLE] || [];

    if (thoughts.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'THOUGHT_NOT_FOUND',
          message: 'No se encontraron pensamientos con los IDs proporcionados'
        })
      };
    }

    // Verificar ownership
    const unauthorized = thoughts.filter(t => t.userId !== userId);
    if (unauthorized.length > 0) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'UNAUTHORIZED',
          message: 'No tienes permiso para acceder a estos pensamientos'
        })
      };
    }

    // Verificar si faltan algunos pensamientos
    const foundIds = new Set(thoughts.map(t => t.thoughtId));
    const missingIds = thoughtIds.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'THOUGHT_NOT_FOUND',
          message: 'Algunos pensamientos no fueron encontrados',
          missingIds
        })
      };
    }

    // 3. Crear items ordenados por createdAt
    const sortedThoughts = thoughts.sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );

    const items = sortedThoughts.map((thought, index) => ({
      itemId: uuidv4(),
      content: thought.content,
      completed: false,
      order: index,
      sourceThoughtId: thought.thoughtId,
      sourceThoughtCreatedAt: thought.createdAt
    }));

    // 4. Resolver tags (combinar tags de thoughts + nuevos)
    const allTags = new Set();
    thoughts.forEach(t => {
      if (t.tagNames && Array.isArray(t.tagNames)) {
        t.tagNames.forEach(tag => allTags.add(tag));
      }
    });
    
    // Agregar tags adicionales proporcionados
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => allTags.add(tag));
    }

    const { tagIds, tagNames } = await tagService.parseAndResolveTags(
      Array.from(allTags), 
      userId
    );

    // 5. Crear lista
    const listId = uuidv4();
    const timestamp = new Date().toISOString();

    const newList = {
      listId,
      userId,
      name: listName.trim(),
      items,
      tagIds,
      tagNames,
      tagSource: 'Manual',
      sourceType: 'thoughts',
      createdFromThoughts: true,
      createdAt: timestamp,
      createdBy: userId,
      updatedAt: timestamp,
      lastModifiedBy: userId
    };

    // 6. Guardar lista
    await docClient.put({
      TableName: LISTS_TABLE,
      Item: newList
    }).promise();

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newList)
    };

  } catch (error) {
    console.error('createListFromThoughts error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al crear la lista desde pensamientos.' })
    };
  }
};
