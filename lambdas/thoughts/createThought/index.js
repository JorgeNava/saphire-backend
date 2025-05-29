/**
 * Lambda — createThought
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/thoughts \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "content":"Quiero visitar Japón este verano #viajes #aventura",
 *     // opcional: "createdBy":"usuario"
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient           = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const THOUGHTS_TBL        = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const TAGS_TBL            = process.env.AWS_DYNAMODB_TABLE_TAGS;
const OPENAI_API_ENDPOINT = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY          = process.env.OPENAI_API_KEY_AWS_USE;

// Clasifica etiquetas: primero extrae hashtags y si no hay, sugiere con IA.
async function classifyTags(text, existingNames) {
  const resp = await fetch(OPENAI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `
Eres un clasificador de etiquetas para "thoughts".
Detecta primero hashtags en el texto (p. ej. #viajes) y úsalos si coinciden con etiquetas existentes.
Si no hay hashtags o no coinciden, sugiere hasta dos etiquetas nuevas, en una sola palabra, separadas por comas.
Solo responde con nombres de etiquetas separados por comas.`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 20
    })
  });
  const data    = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

exports.handler = async (event) => {
  try {
    const { userId, content, createdBy: cbParam } = JSON.parse(event.body || '{}');
    if (!userId || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId y content son requeridos.' })
      };
    }

    // 1) Cargar todas las etiquetas actuales
    const tagsData = await docClient.scan({
      TableName:               TAGS_TBL,
      ProjectionExpression:    'tagId, #n',
      ExpressionAttributeNames: { '#n': 'name' }
    }).promise();
    const existing = tagsData.Items || [];
    const names    = existing.map(t => t.name.toLowerCase());

    // 2) Extraer o sugerir etiquetas
    const chosenNames = await classifyTags(content, names);
    const finalTagIds = existing
      .filter(t => chosenNames.includes(t.name.toLowerCase()))
      .map(t => t.tagId);

    // 3) Detectar hashtags explícitos en el contenido
    const explicitHashtags = (content.match(/#(\w+)/g) || [])
      .map(h => h.substring(1).toLowerCase());
    const hasExplicit = explicitHashtags.some(tag => names.includes(tag));

    // 4) Asignar tagSource: Manual si hubo hashtags del content, IA si fueron sugeridas por OpenAI
    const tagSource = hasExplicit ? 'Manual' : 'IA';

    // 5) Asignar createdBy: valor de la petición si viene, o "Manual" por defecto
    const createdBy = (typeof cbParam === 'string' && cbParam.trim() !== '')
      ? cbParam
      : 'Manual';

    // 6) Construir y guardar el thought
    const thoughtId = uuidv4();
    const timestamp = new Date().toISOString();
    const item = {
      thoughtId,
      userId,
      content,
      tagIds:         finalTagIds,
      tagSource,
      createdAt:      timestamp,
      updatedAt:      timestamp,
      createdBy,
      lastModifiedBy: createdBy
    };

    await docClient.put({
      TableName: THOUGHTS_TBL,
      Item:      item
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify(item)
    };
  } catch (err) {
    console.error('createThought error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear el thought.' })
    };
  }
};
