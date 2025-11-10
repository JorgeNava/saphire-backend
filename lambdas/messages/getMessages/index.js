/**
 * Lambda — getMessages
 * GET /messages
 * Permite filtrar por conversationId (requerido) y opcionales:
 * sender, inputType, createdAt (>=), updatedAt (>=),
 * tagIds (al menos uno de ellos), usedAI, createdBy, lastModifiedBy.
 *
 * Nuevos parámetros de paginación:
 * - limit: resultados por página (default: 50, max: 100)
 * - lastKey: token de paginación (URL encoded)
 * - sortOrder: asc | desc (default: asc)
 *
 * Ejemplo:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/messages?conversationId=conv123&limit=20&sortOrder=desc"
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    // Aceptar tanto conversationId como userId (para backward compatibility)
    const conversationId = qs.conversationId || qs.userId;
    const { limit = '50', lastKey, sortOrder = 'asc' } = qs;
    
    if (!conversationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El query param conversationId o userId es requerido.' })
      };
    }

    // Validar y parsear límite
    const pageLimit = Math.min(parseInt(limit) || 50, 100);

    // Base del query
    const params = {
      TableName: MSG_TABLE,
      KeyConditionExpression: 'conversationId = :c',
      ExpressionAttributeValues: {
        ':c': conversationId
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

    if (qs.sender) {
      filters.push('sender = :sender');
      eav[':sender'] = qs.sender;
    }
    if (qs.inputType) {
      filters.push('inputType = :inputType');
      eav[':inputType'] = qs.inputType;
    }
    if (qs.createdAt) {
      filters.push('createdAt >= :createdAt');
      eav[':createdAt'] = qs.createdAt;
    }
    if (qs.updatedAt) {
      filters.push('updatedAt >= :updatedAt');
      eav[':updatedAt'] = qs.updatedAt;
    }
    if (qs.usedAI !== undefined) {
      // recibimos "true" o "false"
      const usedAI = qs.usedAI === 'true';
      filters.push('usedAI = :usedAI');
      eav[':usedAI'] = usedAI;
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
    // Búsqueda por nombre de tag (tagNames)
    if (qs.tagNames) {
      const tagNames = qs.tagNames.split(',').map(t => t.trim()).filter(Boolean);
      if (tagNames.length) {
        const nameFilters = [];
        tagNames.forEach((name, idx) => {
          const key = `:tagName${idx}`;
          nameFilters.push(`contains(tagNames, ${key})`);
          eav[key] = name;
        });
        filters.push(`(${nameFilters.join(' OR ')})`);
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
    console.error('getMessages error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al listar mensajes.' })
    };
  }
};
