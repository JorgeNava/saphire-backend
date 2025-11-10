/**
 * Lambda — refreshListFromTags
 * POST /lists/{listId}/refresh-from-tags
 * 
 * Actualiza una lista creada desde etiquetas, agregando pensamientos nuevos
 * que coincidan con esas etiquetas y que no estén ya en la lista.
 * 
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}/refresh-from-tags \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123"
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;
const THOUGHTS_TABLE = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const INDEX_NAME = 'GSI-userThoughts';

/**
 * Busca pensamientos por etiquetas usando el filtro tagNames
 */
async function findThoughtsByTags(userId, tagNames) {
  const params = {
    TableName: THOUGHTS_TABLE,
    IndexName: INDEX_NAME,
    KeyConditionExpression: 'userId = :u',
    ExpressionAttributeValues: {
      ':u': userId
    },
    ScanIndexForward: false, // Más recientes primero
    Limit: 200 // Límite amplio para capturar todos los posibles
  };

  // Agregar filtro por tagNames (OR logic)
  const tagNameFilters = [];
  tagNames.forEach((tagName, idx) => {
    const key = `:tagName${idx}`;
    tagNameFilters.push(`contains(tagNames, ${key})`);
    params.ExpressionAttributeValues[key] = tagName;
  });

  if (tagNameFilters.length > 0) {
    params.FilterExpression = `(${tagNameFilters.join(' OR ')})`;
  }

  const result = await docClient.query(params).promise();
  return result.Items || [];
}

exports.handler = async (event) => {
  try {
    const { listId } = event.pathParameters;
    const { userId } = JSON.parse(event.body);

    // 1. Validar input
    if (!listId || !userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'listId y userId son requeridos'
        })
      };
    }

    // 2. Obtener la lista
    const listResult = await docClient.get({
      TableName: LISTS_TABLE,
      Key: { listId }
    }).promise();

    const list = listResult.Item;

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
          message: 'No tienes permiso para modificar esta lista'
        })
      };
    }

    // 3. Verificar que la lista fue creada desde etiquetas
    if (!list.createdFromTags || !list.searchedTags || list.searchedTags.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'NOT_TAG_BASED_LIST',
          message: 'Esta lista no fue creada desde etiquetas y no puede ser actualizada automáticamente'
        })
      };
    }

    // 4. Buscar pensamientos con las etiquetas originales
    const thoughts = await findThoughtsByTags(userId, list.searchedTags);

    // 5. Filtrar pensamientos que ya están en la lista
    const existingThoughtIds = new Set(
      (list.items || [])
        .filter(item => item.sourceThoughtId)
        .map(item => item.sourceThoughtId)
    );

    const newThoughts = thoughts.filter(
      thought => !existingThoughtIds.has(thought.thoughtId)
    );

    if (newThoughts.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'No hay pensamientos nuevos para agregar',
          addedCount: 0,
          list: list
        })
      };
    }

    // 6. Crear nuevos items desde los pensamientos
    const currentMaxOrder = list.items.length > 0 
      ? Math.max(...list.items.map(item => item.order || 0))
      : -1;

    const newItems = newThoughts.map((thought, index) => ({
      itemId: uuidv4(),
      content: thought.content,
      completed: false,
      order: currentMaxOrder + index + 1,
      sourceThoughtId: thought.thoughtId,
      sourceThoughtCreatedAt: thought.createdAt,
      addedAt: new Date().toISOString()
    }));

    // 7. Actualizar la lista con los nuevos items
    const updatedItems = [...list.items, ...newItems];
    const updatedAt = new Date().toISOString();

    const updateParams = {
      TableName: LISTS_TABLE,
      Key: { listId },
      UpdateExpression: 'SET #items = :i, updatedAt = :u, lastModifiedBy = :m, thoughtsFound = :tf, lastRefreshedAt = :lr',
      ExpressionAttributeNames: {
        '#items': 'items'
      },
      ExpressionAttributeValues: {
        ':i': updatedItems,
        ':u': updatedAt,
        ':m': userId,
        ':tf': updatedItems.length,
        ':lr': updatedAt
      },
      ReturnValues: 'ALL_NEW'
    };

    const updateResult = await docClient.update(updateParams).promise();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Se agregaron ${newItems.length} pensamientos nuevos a la lista`,
        addedCount: newItems.length,
        totalItems: updatedItems.length,
        list: updateResult.Attributes
      })
    };

  } catch (error) {
    console.error('refreshListFromTags error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Error al actualizar la lista desde etiquetas.',
        details: error.message
      })
    };
  }
};
