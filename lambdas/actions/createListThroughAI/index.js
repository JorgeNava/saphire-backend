/**
 * Actions — CreateListThroughAI
 * Crea una lista en DynamoDB usando IA para extraer nombre y elementos.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;
const MSG_TABLE   = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const OPENAI_URL  = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY  = process.env.OPENAI_API_KEY_AWS_USE;

async function generateListConfirmation(listName, itemCount, itemsPreview, originalContent) {
  const prompt = `Eres Saphira, un asistente personal. El usuario te pidió crear una lista y la creaste exitosamente.

Mensaje original del usuario: "${originalContent.substring(0, 200)}"
Lista creada: "${listName}" con ${itemCount} elementos: ${itemsPreview}

Genera una respuesta breve y natural (1-2 oraciones) confirmando la creación de la lista. Menciona el nombre y cuántos elementos tiene. Puedes sugerir algo relevante. Responde en español.`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || `Listo, creé la lista "${listName}" con ${itemCount} elementos. 📋`;
  } catch {
    return `Listo, creé la lista "${listName}" con ${itemCount} elementos. 📋`;
  }
}

exports.handler = async (event) => {
  let userId;
  try {
    const bodyParsed = JSON.parse(event.body || '{}');
    userId = bodyParsed.userId;
    const { content } = bodyParsed;
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

    // Guardar confirmación IA como mensaje en el chat
    try {
      const itemsPreview = items.slice(0, 5).join(', ');
      const extra = items.length > 5 ? ` y ${items.length - 5} más` : '';
      const confirmContent = await generateListConfirmation(name, items.length, itemsPreview + extra, content);
      const msgNow = new Date().toISOString();
      await docClient.put({
        TableName: MSG_TABLE,
        Item: {
          conversationId: userId,
          timestamp: msgNow,
          messageId: uuidv4(),
          sender: 'IA',
          content: confirmContent,
          inputType: 'text',
          intent: 'list',
          tagIds: [],
          tagNames: [],
          tagSource: null,
          createdAt: msgNow,
          updatedAt: msgNow,
        },
      }).promise();
    } catch (msgErr) {
      console.warn('createListThroughAI - Error al guardar mensaje confirmación:', msgErr.message);
    }

    return {
      statusCode: 201,
      body: JSON.stringify(listItem)
    };
  } catch (err) {
    console.error('CreateListThroughAI error:', err);

    try {
      if (userId && MSG_TABLE) {
        const errNow = new Date().toISOString();
        await docClient.put({
          TableName: MSG_TABLE,
          Item: {
            conversationId: userId,
            timestamp: errNow,
            messageId: uuidv4(),
            sender: 'IA',
            content: 'Lo siento, hubo un error al crear tu lista. Intenta de nuevo.',
            inputType: 'text',
            intent: 'error',
            tagIds: [],
            tagNames: [],
            tagSource: null,
            createdAt: errNow,
            updatedAt: errNow,
          },
        }).promise();
      }
    } catch (saveErr) {
      console.error('Error al guardar mensaje de error:', saveErr.message);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear lista con IA.' })
    };
  }
};
