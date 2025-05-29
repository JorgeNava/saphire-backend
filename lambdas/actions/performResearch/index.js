/**
 * Lambda — PerformResearch
 * Realiza investigación con IA y guarda el resultado en una nota de DynamoDB.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const NOTES_TABLE = process.env.AWS_DYNAMODB_TABLE_NOTES;
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

    // 1) Pedir a OpenAI un resumen de investigación
    const prompt = `
Eres un asistente de investigación académica. Para el tema siguiente, genera
un informe estructurado que incluya:
  1. Resumen breve
  2. Puntos clave en viñetas
  3. Referencias o fuentes (si las conoces)
Tema: "${content}"
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
        max_tokens: 500,
        temperature: 0.7
      })
    });
    const data    = await resp.json();
    const report  = data.choices?.[0]?.message?.content?.trim() || '';
    if (!report) {
      return { statusCode: 500, body: JSON.stringify({ error: 'IA no devolvió contenido.' }) };
    }

    // 2) Construir y guardar la nota en DynamoDB
    const noteId = uuidv4();
    const now    = new Date().toISOString();
    const note   = {
      noteId,
      userId,
      title: `Investigación: ${content.substring(0, 30)}...`,
      content: report,
      attachmentKeys: [],
      tagIds: [],
      tagSource: 'AI',
      createdAt: now,
      updatedAt: now,
      createdBy: 'AI',
      lastModifiedBy: 'AI'
    };

    await docClient.put({
      TableName: NOTES_TABLE,
      Item: note
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify(note)
    };
  } catch (err) {
    console.error('PerformResearch error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al realizar investigación.' })
    };
  }
};
