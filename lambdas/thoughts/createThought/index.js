/**
 * Lambda — createThought
 * POST /thoughts
 * 
 * - Corrige ortografía y normaliza hashtags antes de guardar.
 * - Hasta 5 etiquetas (2–5).
 * - Permite etiquetas de varias palabras (p.ej. "Cosas por hacer").
 * - Detecta instrucción explícita (“etiquétalo como...”, hashtags) → tagSource = 'Manual'
 * - Si no, IA sugiere de 2 a 5 etiquetas → tagSource = 'IA'
 * - Crea en Dynamo las etiquetas nuevas si no existían, con color aleatorio.
 * - Guarda tanto tagIds como tagNames.
 * - createdBy: payload.createdBy o "Manual"
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient           = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const THOUGHTS_TBL        = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const TAGS_TBL            = process.env.AWS_DYNAMODB_TABLE_TAGS;
const OPENAI_API_ENDPOINT = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY          = process.env.OPENAI_API_KEY_AWS_USE;

// 1) Limpia el texto: corrige ortografía, tildes y formatea hashtags
async function aiCleanText(text) {
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
Eres un corrector de texto. Tu misión es:
- Hacer los menores cambios posibles para corregir ortografía y tildes.
- Normalizar hashtags: convierte #cosasPorHacer o #CosasPorHacer en "#cosas por hacer".
- Mantén los hashtags intactos (solo cambiando su formato), y no agregues ni quites ninguno.
- No cambies ni elimines el resto del texto; conserva su significado.
`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 60
    })
  });
  const data    = await resp.json();
  const clean   = data.choices?.[0]?.message?.content?.trim() || text;
  return clean;
}

// 2) Sugiere 2–5 etiquetas sólo si no hay hashtags explícitos
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
        {
          role: 'system',
          content: `
Eres un clasificador de etiquetas para "thoughts".  
1) Si el texto contiene hashtags (“#”), normalízalos y devuélvelos como etiquetas (capitalizadas).
2) Si NO hay hashtags explícitos, sugiere entre 2 y 5 etiquetas descriptivas de varias palabras (p.ej. "Cosas por hacer", "Libros por leer").
3) Solo devuelve la lista de etiquetas separadas por comas, sin añadidos.
`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 60
    })
  });
  const data  = await resp.json();
  const raw   = data.choices?.[0]?.message?.content || '';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => s)
    .map(s => s[0].toUpperCase() + s.slice(1).toLowerCase())
    .slice(0, 5);
}

// 3) Crea un color HEX aleatorio
function randomColor() {
  const hex = Math.floor(Math.random() * 0xFFFFFF)
    .toString(16)
    .padStart(6, '0');
  return `#${hex}`;
}

// 4) Crea un tag nuevo en Dynamo y devuelve su ID
async function createTag(name, userId) {
  const tagId = uuidv4();
  const now   = new Date().toISOString();
  const item  = {
    tagId,
    userId,
    name,
    color: randomColor(),
    createdAt:      now,
    updatedAt:      now,
    createdBy:      userId,
    lastModifiedBy: userId
  };
  await docClient.put({ TableName: TAGS_TBL, Item: item }).promise();
  return { tagId, name };
}

exports.handler = async (event) => {
  try {
    // parse payload (API Gateway vs SDK invoke)
    let payload;
    if (typeof event.body === 'string') {
      payload = JSON.parse(event.body);
    } else {
      payload = event;
    }
    const { userId, content: rawContent, createdBy: cbParam } = payload;
    if (!userId || !rawContent) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId y content son requeridos.' }) };
    }

    // 1) Limpia el texto
    const content = await aiCleanText(rawContent);

    // 2) Carga tags existentes
    const tagsData = await docClient.scan({
      TableName: TAGS_TBL,
      ProjectionExpression: 'tagId, #n, userId',
      ExpressionAttributeNames: { '#n': 'name' }
    }).promise();
    const existing = tagsData.Items || [];
    const byName   = Object.fromEntries(existing.map(t => [t.name.toLowerCase(), t]));

    // 3) Detecta hashtags explícitos o instrucciones
    const instrRx    = /\b(etiqu[eé]talo como|ponle las etiquetas)\b/i;
    const hasInstr   = instrRx.test(content);
    const hashtags   = (content.match(/#([\p{L}\s]+)/gu) || [])
      .map(h => h.substring(1).trim().toLowerCase());
    let finalNames;
    let tagSource;

    if (hasInstr || hashtags.length) {
      // Manual: usa hasta 5 explícitos
      const expl = hasInstr
        ? (content.match(/(?:etiqu[eé]talo como|ponle las etiquetas)[^#]*?([^\n]+)/i)?.[1] || '')
            .split(/[,;]+/).map(s=>s.trim())
        : hashtags.map(h=>h[0].toUpperCase() + h.slice(1));
      finalNames = Array.from(new Set(expl)).slice(0, 5);
      tagSource  = 'Manual';
    } else {
      // IA: sugiere
      finalNames = await aiSuggestTags(content);
      tagSource  = 'IA';
    }

    // 4) Resuelve tagIds y tagNames (creando nuevas si faltan)
    const tagIds   = [];
    const tagNames = [];
    for (const name of finalNames) {
      const key = name.toLowerCase();
      if (byName[key]) {
        tagIds.push(byName[key].tagId);
        tagNames.push(byName[key].name);
      } else {
        const { tagId, name: createdName } = await createTag(name, userId);
        tagIds.push(tagId);
        tagNames.push(createdName);
      }
    }

    // 5) Determina createdBy
    const createdBy = (cbParam && cbParam.trim()) ? cbParam : 'Manual';

    // 6) Guarda el thought
    const thoughtId = uuidv4();
    const now       = new Date().toISOString();
    const item = {
      thoughtId,
      userId,
      content,
      tagIds,
      tagNames,
      tagSource,
      createdAt:      now,
      updatedAt:      now,
      createdBy,
      lastModifiedBy: createdBy
    };
    await docClient.put({ TableName: THOUGHTS_TBL, Item: item }).promise();

    return { statusCode: 201, body: JSON.stringify(item) };

  } catch (err) {
    console.error('createThought error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error al crear el thought.' }) };
  }
};
