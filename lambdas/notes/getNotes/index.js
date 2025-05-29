/**
 * Notes — getNotes
 * GET /notes
 * Permite filtrar por userId (requerido) y opcionales:
 * title (contiene), tagIds (al menos uno), tagSource,
 * createdAt (>=), updatedAt (>=), createdBy, lastModifiedBy.
 *
 * Ejemplo:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/notes?userId=user123&tagIds=tag1,tag2"
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;
const INDEX_NAME = 'GSI-userNotes';

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
      TableName:             TABLE_NAME,
      IndexName:             INDEX_NAME,
      KeyConditionExpression:'userId = :u',
      ExpressionAttributeValues: {
        ':u': userId
      },
      ScanIndexForward:      true
    };

    // Construir FilterExpression dinámicamente
    const filters = [];
    const eav = params.ExpressionAttributeValues;

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
      body: JSON.stringify(result.Items || [])
    };

  } catch (err) {
    console.error('getNotes error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al listar notas.' })
    };
  }
};
