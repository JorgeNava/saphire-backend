/**
 * Lambda — createMessage
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/messages \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "conversationId":"conv123",
 *     "sender":"user123",
 *     "content":"¡Hola, mundo!",
 *     // opcional: "tagIds":["tag1","tag2"]
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const docClient  = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const MSG_TABLE  = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const TAGS_TABLE = process.env.AWS_DYNAMODB_TABLE_TAGS;
const OPENAI_API_ENDPOINT = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY = process.env.OPENAI_API_KEY_AWS_USE;

async function classifyTags(text, sender, existingNames) {
  const resp = await fetch(OPENAI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `Eres un clasificador de etiquetas para mensajes de ${sender}.
Las etiquetas existentes son: ${existingNames.join(', ')}.
Si ninguna aplica, sugiere hasta dos nuevas en una sola palabra, separadas por coma.
Solo responde con nombres separados por comas.`
        },
        { role: 'user', content: text }
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
    const { conversationId, sender, content, tagIds } = JSON.parse(event.body);
    if (!conversationId || !sender || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'conversationId, sender y content son requeridos.' })
      };
    }

    // 1) Leemos todas las etiquetas actuales
    const tagsData = await docClient.scan({
      TableName: TAGS_TABLE,
      ProjectionExpression: 'tagId, #n',
      ExpressionAttributeNames: { '#n': 'name' }
    }).promise();
    const existing = tagsData.Items || [];
    const names    = existing.map(t => t.name);

    // 2) Calculamos tagIds finales
    let finalTagIds = tagIds;
    let usedAI = false;
    let createdBy = sender;
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      const chosen = await classifyTags(content, sender, names);
      finalTagIds = existing
        .filter(t => chosen.includes(t.name.toLowerCase()))
        .map(t => t.tagId);
      usedAI = true;
      createdBy = 'AI';
    }

    // 3) Creamos y guardamos el mensaje
    const messageId   = uuidv4();
    const timestamp   = new Date().toISOString();
    const item = {
      conversationId,
      timestamp,
      messageId,
      sender,
      content,
      inputType:    'text',
      createdAt:    timestamp,
      updatedAt:    timestamp,
      tagIds:       finalTagIds,
      usedAI,
      createdBy,
      lastModifiedBy: createdBy
    };

    await docClient.put({
      TableName: MSG_TABLE,
      Item: item
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify(item)
    };
  } catch (err) {
    console.error('createMessage error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear el mensaje.' })
    };
  }
};
