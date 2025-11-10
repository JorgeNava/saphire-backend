/**
 * Notes — getNotes
 * GET /notes
 * Permite filtrar por userId (requerido) y opcionales:
 * title (contiene), tagIds (al menos uno), tagSource,
 * createdAt (>=), updatedAt (>=), createdBy, lastModifiedBy.
 *
 * Nuevos parámetros:
 * - limit: resultados por página (default: 50, max: 100)
 * - lastKey: para paginación
 * - sortBy: createdAt | updatedAt | title (default: createdAt)
 * - sortOrder: asc | desc (default: desc)
 * - includeDeleted: true | false (default: false)
 *
 * Ejemplo:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/notes?userId=user123&limit=20&sortBy=updatedAt&sortOrder=desc"
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const { 
      userId, 
      limit = '50', 
      lastKey, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      includeDeleted = 'false'
    } = qs;
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El query param userId es requerido.' })
      };
    }

    // Validar y parsear límite
    const pageLimit = Math.min(parseInt(limit) || 50, 100);

    // Determinar índice según sortBy
    let indexName = 'GSI-userNotesByDate';
    if (sortBy === 'title') {
      indexName = 'GSI-userNotes';
    }

    // Base del query
    const params = {
      TableName: TABLE_NAME,
      IndexName: indexName,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: {
        ':u': userId
      },
      ScanIndexForward: sortOrder === 'asc',
      Limit: pageLimit
    };

    // Paginación
    if (lastKey) {
      try {
        params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));
      } catch (err) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'lastKey inválido.' })
        };
      }
    }

    // Construir FilterExpression dinámicamente
    const filters = [];
    const eav = params.ExpressionAttributeValues;

    // Excluir notas eliminadas por defecto
    if (includeDeleted !== 'true') {
      filters.push('attribute_not_exists(deletedAt)');
    }

    if (qs.title) {
      filters.push('contains(title, :title)');
      eav[':title'] = qs.title;
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
        const tagFilters = [];
        tags.forEach((tag, idx) => {
          const key = `:tag${idx}`;
          tagFilters.push(`contains(tagIds, ${key})`);
          eav[key] = tag;
        });
        filters.push(`(${tagFilters.join(' OR ')})`);
      }
    }

    if (filters.length) {
      params.FilterExpression = filters.join(' AND ');
    }

    // Ejecutar query
    const result = await docClient.query(params).promise();
    
    return {
      statusCode: 200,
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
    console.error('getNotes error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al listar notas.' })
    };
  }
};
