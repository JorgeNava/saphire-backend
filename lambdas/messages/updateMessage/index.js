/**
 * Lambda — updateMessage
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/messages/{conversationId}/{timestamp} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "sender":"user123",
 *     "content":"Texto modificado",
 *     // opcional: "tagIds":["tag1","tag3"]
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const MSG_TABLE  = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const TAGS_TABLE = process.env.AWS_DYNAMODB_TABLE_TAGS;
const OPENAI_API_ENDPOINT = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY = process.env.OPENAI_API_KEY_AWS_USE;

async function classifyTags(text, sender, existingNames) {
  const resp = await fetch(OPENAI_API_ENDPOINT, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      Authorization:`Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model:'gpt-4-turbo',
      messages:[
        { role:'system',
          content:`Eres un clasificador de etiquetas para mensajes de ${sender}.  
Las etiquetas existentes son: ${existingNames.join(', ')}.  
Si ninguna aplica, sugiere hasta dos nuevas en una sola palabra, separadas por coma.` 
        },
        { role:'user', content:text }
      ],
      max_tokens:20
    })
  });
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
}

exports.handler = async (event) => {
  try {
    const { conversationId, timestamp } = event.pathParameters;
    const { sender, content, tagIds } = JSON.parse(event.body);
    if (!conversationId || !timestamp || !sender || !content) {
      return { statusCode:400,
        body: JSON.stringify({ error:'conversationId, timestamp, sender y content son requeridos.' }) };
    }

    // 1) cargar etiquetas existentes
    const tagsData = await docClient.scan({
      TableName:TAGS_TABLE,
      ProjectionExpression:'tagId,name'
    }).promise();
    const existing = tagsData.Items || [];
    const names    = existing.map(t=>t.name);

    // 2) decidir nuevos tagIds
    let finalTagIds = tagIds;
    let usedAI = false;
    let lastModifiedBy = sender;
    if (!Array.isArray(tagIds) || tagIds.length===0) {
      const chosen = await classifyTags(content, sender, names);
      finalTagIds = existing
        .filter(t => chosen.includes(t.name.toLowerCase()))
        .map(t => t.tagId);
      usedAI = true;
      lastModifiedBy = 'AI';
    }

    // 3) aplicar update
    const updatedAt = new Date().toISOString();
    const params = {
      TableName: MSG_TABLE,
      Key: { conversationId, timestamp },
      UpdateExpression: [
        'SET content = :c',
        ' , tagIds = :t',
        ' , updatedAt = :u',
        ' , lastModifiedBy = :l'
      ].join(''),
      ExpressionAttributeValues: {
        ':c': content,
        ':t': finalTagIds,
        ':u': updatedAt,
        ':l': lastModifiedBy
      },
      ReturnValues: 'ALL_NEW'
    };

    const res = await docClient.update(params).promise();
    return { statusCode:200, body: JSON.stringify(res.Attributes) };
  } catch (err) {
    console.error(err);
    return { statusCode:500,
      body: JSON.stringify({ error:'Error al actualizar mensaje.' }) };
  }
};
