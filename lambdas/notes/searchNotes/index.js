/**
 * Lambda — searchNotes
 * GET /notes/search
 * Búsqueda full-text en título y contenido con paginación
 * 
 * Query params:
 * - userId (requerido)
 * - q (requerido): texto a buscar
 * - limit (opcional): resultados por página (default: 20, max: 100)
 * - lastKey (opcional): para paginación
 * - sortBy (opcional): createdAt | updatedAt | title (default: createdAt)
 * - sortOrder (opcional): asc | desc (default: desc)
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;
const INDEX_NAME = 'GSI-userNotesByDate';

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const { userId, q, limit = '20', lastKey, sortBy = 'createdAt', sortOrder = 'desc' } = qs;

    if (!userId || !q) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId y q (query) son requeridos.' })
      };
    }

    const searchQuery = q.toLowerCase().trim();
    const pageLimit = Math.min(parseInt(limit) || 20, 100);

    // Query base: obtener todas las notas del usuario (no eliminadas)
    const params = {
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: 'userId = :uid',
      FilterExpression: 'attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':uid': userId
      },
      ScanIndexForward: sortOrder === 'asc'
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

    // Ejecutar query
    const result = await docClient.query(params).promise();
    
    // Búsqueda full-text en memoria (filtrar por título y contenido)
    const matches = (result.Items || []).filter(note => {
      const titleMatch = note.title.toLowerCase().includes(searchQuery);
      const contentMatch = note.content.toLowerCase().includes(searchQuery);
      return titleMatch || contentMatch;
    });

    // Ordenar según sortBy
    matches.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'updatedAt':
          aVal = a.updatedAt;
          bVal = b.updatedAt;
          break;
        case 'createdAt':
        default:
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Aplicar límite
    const paginatedResults = matches.slice(0, pageLimit);

    // Generar snippets con highlights
    const resultsWithSnippets = paginatedResults.map(note => {
      const snippet = generateSnippet(note.content, searchQuery);
      return {
        ...note,
        snippet,
        relevance: calculateRelevance(note, searchQuery)
      };
    });

    // Ordenar por relevancia
    resultsWithSnippets.sort((a, b) => b.relevance - a.relevance);

    return {
      statusCode: 200,
      body: JSON.stringify({
        results: resultsWithSnippets,
        count: resultsWithSnippets.length,
        total: matches.length,
        hasMore: result.LastEvaluatedKey !== undefined,
        lastKey: result.LastEvaluatedKey 
          ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
          : null
      })
    };

  } catch (err) {
    console.error('searchNotes error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al buscar notas.' })
    };
  }
};

/**
 * Genera un snippet del contenido con la query resaltada
 */
function generateSnippet(content, query, maxLength = 200) {
  const lowerContent = content.toLowerCase();
  const queryIndex = lowerContent.indexOf(query.toLowerCase());

  if (queryIndex === -1) {
    // Si no está en contenido, retornar inicio
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  // Calcular inicio y fin del snippet centrado en la query
  const start = Math.max(0, queryIndex - 50);
  const end = Math.min(content.length, queryIndex + query.length + 150);
  
  let snippet = content.substring(start, end);
  
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Calcula relevancia basada en:
 * - Aparición en título (peso mayor)
 * - Frecuencia en contenido
 * - Posición en contenido (más arriba = más relevante)
 */
function calculateRelevance(note, query) {
  let score = 0;
  const lowerQuery = query.toLowerCase();
  const lowerTitle = note.title.toLowerCase();
  const lowerContent = note.content.toLowerCase();

  // Título exacto: +100
  if (lowerTitle === lowerQuery) score += 100;
  // Título contiene: +50
  else if (lowerTitle.includes(lowerQuery)) score += 50;

  // Contar ocurrencias en contenido
  const contentMatches = (lowerContent.match(new RegExp(lowerQuery, 'g')) || []).length;
  score += contentMatches * 5;

  // Posición en contenido (más arriba = más relevante)
  const firstIndex = lowerContent.indexOf(lowerQuery);
  if (firstIndex !== -1) {
    const positionScore = Math.max(0, 20 - (firstIndex / 100));
    score += positionScore;
  }

  return score;
}
