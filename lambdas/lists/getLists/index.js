/**
 * Lambda — getLists
 * GET /lists
 * Permite filtrar por userId (requerido) y opcionales:
 * name o searchTerm (contiene), tagIds (al menos uno), tagSource,
 * createdAt (>=), updatedAt (>=), createdBy, lastModifiedBy.
 *
 * Ejemplos:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/lists?userId=user123&searchTerm=compras"
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/lists?userId=user123&tagIds=tag1,tag2"
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;
const INDEX_NAME = 'GSI-userLists';

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const { userId } = qs;
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El query param userId es requerido.' })
      };
    }

    // Base del query
    const params = {
      TableName:                TABLE_NAME,
      IndexName:                INDEX_NAME,
      KeyConditionExpression:   'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      ScanIndexForward:         true
    };

    // Construir FilterExpression dinámicamente
    const filters = [];
    const eav = params.ExpressionAttributeValues;
    const ean = {}; // ExpressionAttributeNames si hacen falta

    // Búsqueda por nombre (acepta 'name' o 'searchTerm' como alias)
    const searchName = qs.name || qs.searchTerm;
    if (searchName) {
      filters.push('contains(#n, :name)');
      ean['#n'] = 'name';
      eav[':name'] = searchName;
    }
    if (qs.tagSource) {
      filters.push('tagSource = :tagSource');
      eav[':tagSource'] = qs.tagSource;
    }
    if (qs.createdAt) {
      filters.push('createdAt >= :createdAt');
      eav[':createdAt'] = qs.createdAt;
    }
    if (qs.updatedAt) {
      filters.push('updatedAt >= :updatedAt');
      eav[':updatedAt'] = qs.updatedAt;
    }
    if (qs.createdBy) {
      filters.push('createdBy = :createdBy');
      eav[':createdBy'] = qs.createdBy;
    }
    if (qs.lastModifiedBy) {
      filters.push('lastModifiedBy = :lastModifiedBy');
      eav[':lastModifiedBy'] = qs.lastModifiedBy;
    }
    if (qs.tagIds) {
      // tagIds como csv: "tag1,tag2"
      const tags = qs.tagIds.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length) {
        const orClauses = tags.map((tag, i) => {
          const key = `:tag${i}`;
          eav[key] = tag;
          return `contains(tagIds, ${key})`;
        });
        filters.push(`(${orClauses.join(' OR ')})`);
      }
    }

    if (filters.length) {
      params.FilterExpression = filters.join(' AND ');
      if (Object.keys(ean).length) {
        params.ExpressionAttributeNames = ean;
      }
    }

    // Ejecutar query
    const result = await docClient.query(params).promise();
    
    // Ordenar resultados: pinned primero, luego por createdAt descendente
    const sortedItems = (result.Items || []).sort((a, b) => {
      // Primero ordenar por pinned (true antes que false)
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      // Si ambos tienen el mismo estado de pinned, ordenar por createdAt (más reciente primero)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify(sortedItems)
    };
  } catch (err) {
    console.error('getLists error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al listar las listas.' })
    };
  }
};
