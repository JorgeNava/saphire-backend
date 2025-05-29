/**
 * Lambda — createThought
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/thoughts \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "content":"Quiero visitar Japón este verano",
 *     // opcional: "tagIds":["tag1","tag2"]
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient    = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const TAGS_TBL     = process.env.AWS_DYNAMODB_TABLE_TAGS;
const OPENAI_API_ENDPOINT = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY   = process.env.OPENAI_API_KEY_AWS_USE;

async function classifyTags(text, existingNames) {
  const resp = await fetch(OPENAI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      Authorization:`Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages:[
        {
          role: 'system',
          content: `Eres un clasificador de etiquetas para "thoughts".  
Las etiquetas existentes son: ${existingNames.join(', ')}.  
Si ninguna aplica, sugiere hasta dos nuevas en una sola palabra, separadas por coma.  
Solo responde con nombres separados por comas.`
        },
        { role:'user', content: text }
      ],
      max_tokens: 20
    })
  });
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

exports.handler = async (event) => {
  try {
    const { userId, content, tagIds } = JSON.parse(event.body);
    if (!userId || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId y content son requeridos.' })
      };
    }

    // 1) Cargar todas las etiquetas actuales
    const tagsData = await docClient.scan({
      TableName: TAGS_TBL,
      ProjectionExpression: 'tagId, #n',
      ExpressionAttributeNames: { '#n': 'name' }
    }).promise();
    const existing = tagsData.Items || [];
    const names    = existing.map(t => t.name);

    // 2) Determinar tagIds y tagSource
    let finalTagIds, tagSource, createdBy;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      finalTagIds = tagIds;
      tagSource   = 'Manual';
      createdBy   = userId;
    } else {
      const chosen = await classifyTags(content, names);
      finalTagIds = existing
        .filter(t => chosen.includes(t.name.toLowerCase()))
        .map(t => t.tagId);
      tagSource = 'IA';
      createdBy = 'AI';
    }

    // 3) Crear el thought
    const thoughtId = uuidv4();
    const timestamp = new Date().toISOString();
    const item = {
      thoughtId,
      userId,
      content,
      tagIds:       finalTagIds,
      tagSource,
      createdAt:    timestamp,
      updatedAt:    timestamp,
      createdBy,
      lastModifiedBy: createdBy
    };

    await docClient.put({
      TableName: THOUGHTS_TBL,
      Item: item
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
