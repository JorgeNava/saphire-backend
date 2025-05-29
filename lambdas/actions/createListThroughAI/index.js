/**
 * Actions — CreateListThroughAI
 * Crea una lista en DynamoDB usando IA para extraer nombre y elementos.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;
const OPENAI_URL  = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY  = process.env.OPENAI_API_KEY_AWS_USE;

exports.handler = async (event) => {
  try {
    const { userId, content } = JSON.parse(event.body || '{}');
    if (!userId || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId y content son requeridos.' })
      };
    }

    // 1) Preguntar a OpenAI por nombre de lista y elementos en JSON
    const prompt = `
Eres un asistente que extrae de un texto un nombre de lista y sus ítems.
Devuelve EXACTAMENTE un objeto JSON con dos propiedades:
  - "name": cadena con el título de la lista
  - "items": array de cadenas, cada una un elemento de la lista
Texto: """${content}"""
`;
    const resp = await fetch(OPENAI_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    const data = await resp.json();
    const jsonText = data.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(jsonText); }
    catch {
      return { statusCode: 500, body: JSON.stringify({ error: 'Respuesta IA inválida.' }) };
    }

    const { name, items } = parsed;
    if (!name || !Array.isArray(items)) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Formato IA inesperado.' }) };
    }

    // 2) Construir y guardar la lista en DynamoDB
    const listId   = uuidv4();
    const now      = new Date().toISOString();
    const listItem = {
      listId,
      userId,
      name,
      items: items.map(i => ({ itemId: uuidv4(), content: i })),
      tagIds: [],
      tagSource: 'AI',
      createdAt: now,
      updatedAt: now,
      createdBy: 'AI',
      lastModifiedBy: 'AI'
    };

    await docClient.put({
      TableName: LISTS_TABLE,
      Item: listItem
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify(listItem)
    };
  } catch (err) {
    console.error('CreateListThroughAI error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear lista con IA.' })
    };
  }
};
