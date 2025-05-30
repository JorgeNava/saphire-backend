/**
 * Lambda — createThought
 * POST /thoughts
 * 
 * - Hasta 5 etiquetas
 * - Permite etiquetas de varias palabras (p.ej. "Cosas Por Hacer")
 * - Detecta instrucción explícita (“etiquétalo como...”, hashtags) → tagSource = 'Manual'
 * - Si no, IA sugiere de 2 a 5 etiquetas → tagSource = 'IA'
 * - Crea en Dynamo las etiquetas nuevas si no existían
 * - createdBy: payload.createdBy o "Manual"
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const docClient           = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const THOUGHTS_TBL        = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const TAGS_TBL            = process.env.AWS_DYNAMODB_TABLE_TAGS;
const OPENAI_API_ENDPOINT = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY          = process.env.OPENAI_API_KEY_AWS_USE;

// Llama a OpenAI para sugerir entre 2 y 5 etiquetas de varias palabras
async function aiSuggestTags(text) {
  const resp = await fetch(OPENAI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system',
          content: `
Eres un clasificador de etiquetas para "thoughts", actuando como segundo cerebro.
Devuelve entre 2 y 5 etiquetas descriptivas de este texto, permitiendo varias palabras (p.ej. "Cosas Por Hacer", "Hobbies").
Solo responde con los nombres separados por comas, sin comillas.` },
        { role: 'user', content: text }
      ],
      max_tokens: 60
    })
  });
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || '';
  // dividir por comas, recortar espacios y mantener mayúsculas/minúsculas originales
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, 5); // asegurar máximo 5
}

// Crea un tag nuevo y devuelve su ID
async function createTag(name, userId) {
  const tagId = uuidv4();
  const now   = new Date().toISOString();
  const item  = {
    tagId,
    userId,
    name,
    color:      '#cccccc',
    createdAt:  now,
    updatedAt:  now,
    createdBy:  userId,
    lastModifiedBy: userId
  };
  await docClient.put({ TableName: TAGS_TBL, Item: item }).promise();
  return tagId;
}

exports.handler = async (event) => {
  try {
    const payload = (typeof event.body === 'string')
      ? JSON.parse(event.body)
      : event.body || {};

    const { userId, content, createdBy: cbParam } = payload;
    if (!userId || !content) {
      return { statusCode: 400,
        body: JSON.stringify({ error: 'userId y content son requeridos.' }) };
    }

    // 1) Obtener tags existentes
    const tagsData = await docClient.scan({
      TableName: TAGS_TBL,
      ProjectionExpression: 'tagId, #n, userId',
      ExpressionAttributeNames: { '#n': 'name' }
    }).promise();
    const existing = tagsData.Items || [];
    const byName   = Object.fromEntries(
      existing.map(t => [t.name.toLowerCase(), t])
    );

    // 2) Detectar instrucciones o hashtags
    const instrRegex = /\b(etiqu[eé]talo como|ponle las etiquetas)\b/i;
    const hashtags   = (content.match(/#([\p{L}\s]+)/gu) || [])
      .map(h => h.substring(1).trim());
    const hasInstr   = instrRegex.test(content);
    const explicit   = [];

    if (hasInstr) {
      const m = content.match(/(?:etiqu[eé]talo como|ponle las etiquetas)[^#]*?([^\n]+)/i);
      if (m && m[1]) {
        m[1].split(/[,;]+/)
          .map(s => s.trim())
          .forEach(tag => { if(tag) explicit.push(tag); });
      }
    } else {
      explicit.push(...hashtags);
    }
    const uniqExplicit = Array.from(new Set(explicit));

    // 3) Elegir etiquetas y tagSource
    let finalNames, tagSource;
    if (uniqExplicit.length) {
      finalNames = uniqExplicit.slice(0,5);
      tagSource  = 'Manual';
    } else {
      finalNames = await aiSuggestTags(content);
      tagSource  = 'IA';
    }

    // 4) Resolver tagIds (existentes o nuevos)
    const tagIds = [];
    for (const name of finalNames) {
      const key = name.toLowerCase();
      if (byName[key]) {
        tagIds.push(byName[key].tagId);
      } else {
        const newId = await createTag(name, userId);
        tagIds.push(newId);
      }
    }

    // 5) Determinar createdBy
    const createdBy = (cbParam && cbParam.trim() !== '')
      ? cbParam
      : 'Manual';

    // 6) Guardar el thought
    const thoughtId = uuidv4();
    const now       = new Date().toISOString();
    const item = {
      thoughtId,
      userId,
      content,
      tagIds,
      tagSource,
      createdAt: now,
      updatedAt: now,
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
