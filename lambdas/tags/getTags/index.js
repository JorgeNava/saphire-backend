/**
 * Lambda — getTags
 * GET /tags
 * 
 * Obtiene etiquetas del usuario con paginación, búsqueda y ordenamiento.
 * 
 * CURL examples:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/tags?userId=user123"
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/tags?userId=user123&limit=25&searchTerm=trabajo"
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/tags?userId=user123&limit=25&lastKey=encoded-key"
 */

const AWS = require('aws-sdk');
const docClient  = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_TAGS;
const INDEX_NAME = 'GSI-userTags';

exports.handler = async (event) => {
  try {
    const { userId, limit = '25', lastKey, searchTerm, sortOrder = 'desc' } = 
      event.queryStringParameters || {};
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'El query param userId es requerido.' })
      };
    }

    // Validar y limitar el límite
    const limitNum = Math.min(Math.max(parseInt(limit) || 25, 1), 100);

    // 1. Construir query principal
    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      Limit: limitNum,
      ScanIndexForward: sortOrder === 'asc'
    };

    // 2. Configurar KeyConditionExpression (con o sin búsqueda)
    if (searchTerm) {
      // Búsqueda usando begins_with en el RANGE key (name)
      // Nota: búsqueda case-sensitive por limitación de DynamoDB
      queryParams.KeyConditionExpression = 'userId = :userId AND begins_with(#name, :searchTerm)';
      queryParams.ExpressionAttributeNames = { '#name': 'name' };
      queryParams.ExpressionAttributeValues = {
        ':userId': userId,
        ':searchTerm': searchTerm
      };
    } else {
      // Sin búsqueda, solo por userId
      queryParams.KeyConditionExpression = 'userId = :userId';
      queryParams.ExpressionAttributeValues = {
        ':userId': userId
      };
    }

    // 3. Agregar lastKey si existe (para paginación)
    if (lastKey) {
      try {
        queryParams.ExclusiveStartKey = JSON.parse(
          Buffer.from(lastKey, 'base64').toString()
        );
      } catch (e) {
        console.error('Error decoding lastKey:', e);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'lastKey inválido' })
        };
      }
    }

    // 4. Ejecutar query principal
    const result = await docClient.query(queryParams).promise();

    // 5. Calcular totalCount (solo en primera página sin búsqueda)
    let totalCount = result.Count;
    if (!lastKey && !searchTerm) {
      try {
        const countResult = await docClient.query({
          TableName: TABLE_NAME,
          IndexName: INDEX_NAME,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          Select: 'COUNT'
        }).promise();
        totalCount = countResult.Count;
      } catch (e) {
        console.error('Error calculating totalCount:', e);
        // Continuar sin totalCount exacto
      }
    }

    // 6. Codificar lastKey para siguiente página
    const encodedLastKey = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null;

    // 7. Ordenar por usageCount descendente (después del query)
    const sortedItems = (result.Items || []).sort((a, b) => 
      (b.usageCount || 0) - (a.usageCount || 0)
    );

    // 8. Retornar respuesta paginada
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: sortedItems,
        count: result.Count,
        scannedCount: result.ScannedCount,
        lastKey: encodedLastKey,
        hasMore: !!result.LastEvaluatedKey,
        totalCount: totalCount
      })
    };
  } catch (err) {
    console.error('getTags error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Error al listar etiquetas.',
        details: err.message
      })
    };
  }
};
