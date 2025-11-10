/**
 * Lambda — createListFromTags
 * POST /lists/from-tags
 * 
 * Crea una lista automáticamente buscando pensamientos por etiquetas.
 * 
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/lists/from-tags \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "tagNames":["trabajo","urgente"],
 *     "listName":"Tareas urgentes de trabajo",
 *     "includeCompleted":false
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const THOUGHTS_TABLE = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;
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
    Limit: 100 // Límite razonable
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

/**
 * Genera un nombre de lista basado en las etiquetas
 */
function generateListName(tagNames) {
  if (tagNames.length === 1) {
    return `Lista: ${tagNames[0]}`;
  }
  return `Lista: ${tagNames.join(', ')}`;
}

exports.handler = async (event) => {
  try {
    const { userId, tagNames, listName, includeCompleted = false } = JSON.parse(event.body);

    // 1. Validar input
    if (!userId || !tagNames || !Array.isArray(tagNames) || tagNames.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'userId y tagNames (array no vacío) son requeridos'
        })
      };
    }

    if (tagNames.length > 5) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Máximo 5 etiquetas permitidas',
          provided: tagNames.length,
          limit: 5
        })
      };
    }

    // 2. Buscar pensamientos con esas etiquetas
    const thoughts = await findThoughtsByTags(userId, tagNames);

    if (thoughts.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'NO_THOUGHTS_FOUND',
          message: 'No se encontraron pensamientos con esas etiquetas',
          tags: tagNames
        })
      };
    }

    // 3. Generar nombre de lista si no se proporcionó
    const finalListName = listName && listName.trim() 
      ? listName.trim() 
      : generateListName(tagNames);

    // 4. Crear items de lista desde pensamientos
    const items = thoughts.map((thought, index) => ({
      itemId: uuidv4(),
      content: thought.content,
      completed: false,
      order: index,
      sourceThoughtId: thought.thoughtId,
      sourceThoughtCreatedAt: thought.createdAt
    }));

    // 5. Resolver tags
    const { tagIds, tagNames: resolvedTagNames } = await tagService.parseAndResolveTags(
      tagNames, 
      userId
    );

    // 6. Crear lista
    const listId = uuidv4();
    const timestamp = new Date().toISOString();

    const newList = {
      listId,
      userId,
      name: finalListName,
      items,
      tagIds,
      tagNames: resolvedTagNames,
      tagSource: 'Manual',
      sourceType: 'tags',
      createdFromTags: true,
      searchedTags: tagNames,
      thoughtsFound: thoughts.length,
      createdAt: timestamp,
      createdBy: userId,
      updatedAt: timestamp,
      lastModifiedBy: userId
    };

    // 7. Guardar lista
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
    console.error('createListFromTags error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al crear la lista desde etiquetas.' })
    };
  }
};
