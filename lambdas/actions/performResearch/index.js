/**
 * Lambda — PerformResearch
 * Realiza investigación con IA y guarda el resultado en una nota de DynamoDB.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const NOTES_TABLE = process.env.AWS_DYNAMODB_TABLE_NOTES;
const MSG_TABLE   = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const OPENAI_URL  = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY  = process.env.OPENAI_API_KEY_AWS_USE;

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

    // Guardar confirmación IA como mensaje en el chat
    try {
      const confirmPrompt = `Eres Saphira, un asistente personal. El usuario te pidió investigar un tema y completaste la investigación.

Tema solicitado: "${content.substring(0, 200)}"
Título de la nota creada: "${note.title}"
Resumen breve del resultado: "${report.substring(0, 300)}"

Genera una respuesta breve y natural (2-3 oraciones) confirmando que completaste la investigación y la guardaste como nota. Menciona algún hallazgo interesante. Responde en español.`;

      const confirmRes = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [{ role: 'system', content: confirmPrompt }],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });
      const confirmData = await confirmRes.json();
      const confirmContent = confirmData.choices?.[0]?.message?.content?.trim()
        || `Completé la investigación sobre "${content.substring(0, 50)}". La guardé como nota, puedes revisarla ahí. 📝`;

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
          intent: 'research',
          tagIds: [],
          tagNames: [],
          tagSource: null,
          createdAt: msgNow,
          updatedAt: msgNow,
        },
      }).promise();
    } catch (msgErr) {
      console.warn('performResearch - Error al guardar mensaje confirmación:', msgErr.message);
    }

    return {
      statusCode: 201,
      body: JSON.stringify(note)
    };
  } catch (err) {
    console.error('PerformResearch error:', err);

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
            content: 'Lo siento, hubo un error al realizar la investigación. Intenta de nuevo.',
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
      body: JSON.stringify({ error: 'Error al realizar investigación.' })
    };
  }
};
