/**
 * thoughts — getThoughts
 * GET /thoughts
 * Permite filtrar por userId (requerido) y opcionales:
 * tagIds (al menos uno), tagNames (al menos uno), tagSource, 
 * createdAt (>=), updatedAt (>=), createdBy, lastModifiedBy.
 * 
 * Soporta paginación con limit y lastKey.
 *
 * Nuevos parámetros de paginación:
 * - limit: resultados por página (default: 50, max: 100)
 * - lastKey: token de paginación (URL encoded)
 * - sortOrder: asc | desc (default: desc - más recientes primero)
 *
 * Ejemplos:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/thoughts?userId=user123&limit=20&sortOrder=desc"
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/thoughts?userId=user123&tagNames=trabajo,urgente&limit=50"
 */

const AWS = require('aws-sdk');
const docClient    = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const INDEX_NAME   = 'GSI-userThoughts';

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const { userId, limit = '50', lastKey, sortOrder = 'desc' } = qs;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'El query param userId es requerido.' })
      };
    }

    // Validar y parsear límite
    const pageLimit = Math.min(parseInt(limit) || 50, 100);

    // Base del query
    const params = {
      TableName:              THOUGHTS_TBL,
      IndexName:              INDEX_NAME,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: {
        ':u': userId
      },
      ScanIndexForward:       sortOrder === 'asc',
      Limit:                  pageLimit
    };
    
    // Paginación
    if (lastKey) {
      try {
        params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));
      } catch (err) {
        console.error('Error parsing lastKey:', err);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'lastKey inválido.' })
        };
      }
    }

    // Construir FilterExpression dinámicamente
    const filters = [];
    const eav = params.ExpressionAttributeValues;

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
    // Filtro por tagIds (UUIDs) - RECOMENDADO
    // Usa UUIDs únicos para coincidencia exacta sin falsos positivos
    // Ejemplo: tagIds=uuid-1,uuid-2
    if (qs.tagIds) {
      const tags = qs.tagIds.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length) {
        const tagFilters = [];
        tags.forEach((tag, idx) => {
          const key = `:tagId${idx}`;
          tagFilters.push(`contains(tagIds, ${key})`);
          eav[key] = tag;
        });
        filters.push(`(${tagFilters.join(' OR ')})`);
      }
    }
    
    // Filtro por tagNames (nombres de tags) - LEGACY
    // ADVERTENCIA: Usa contains() que busca substring, puede tener falsos positivos
    // Ejemplo: "Peliculas" también encuentra "Peliculas Por Ver"
    // RECOMENDACIÓN: Usar tagIds en su lugar
    if (qs.tagNames) {
      const tagNamesList = qs.tagNames.split(',').map(t => t.trim()).filter(Boolean);
      if (tagNamesList.length) {
        const tagNameFilters = [];
        tagNamesList.forEach((tagName, idx) => {
          const key = `:tagName${idx}`;
          // Buscar en tagNames (case-insensitive usando LOWER)
          tagNameFilters.push(`contains(tagNames, ${key})`);
          eav[key] = tagName;
        });
        filters.push(`(${tagNameFilters.join(' OR ')})`);
      }
    }

    if (filters.length) {
      params.FilterExpression = filters.join(' AND ');
    }

    // Ejecutar query
    const result = await docClient.query(params).promise();
    
    // Preparar respuesta con paginación
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: result.Items || [],
        count: result.Count,
        scannedCount: result.ScannedCount,
        lastKey: result.LastEvaluatedKey 
          ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
          : null,
        hasMore: result.LastEvaluatedKey !== undefined
      })
    };

  } catch (err) {
    console.error('getThoughts error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al listar thoughts.' })
    };
  }
};
