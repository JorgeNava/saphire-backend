/**
 * Lambda — createThought
 * POST /thoughts
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const OPENAI_URL = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY = process.env.OPENAI_API_KEY_AWS_USE;
const THOUGHTS_GSI_USER = 'GSI-userThoughts';

async function generateConfirmation(thoughtContent, tagNames) {
  const tagsInfo = tagNames && tagNames.length > 0
    ? `Etiquetas asignadas: ${tagNames.join(', ')}.`
    : '';

  const prompt = `Eres Zafira, un asistente personal. El usuario acaba de enviarte un mensaje y lo guardaste como pensamiento.

Pensamiento guardado: "${thoughtContent.substring(0, 200)}"
${tagsInfo}

Genera una respuesta breve y natural (1-2 oraciones) confirmando que guardaste su pensamiento. Puedes hacer una pregunta de seguimiento relevante si tiene sentido. Responde en español.`;

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
    return data.choices?.[0]?.message?.content?.trim() || 'Listo, guardé tu pensamiento. 💭';
  } catch {
    return 'Listo, guardé tu pensamiento. 💭';
  }
}

exports.handler = async (event) => {
  let userId;
  try {
    // Parse payload (API Gateway vs SDK invoke)
    let payload;
    if (typeof event.body === 'string') {
      payload = JSON.parse(event.body);
    } else {
      payload = event;
    }
    const {
      content,
      tags,
      tagIds: existingTagIds,
      tagNames: existingTagNames,
      tagSource,
      createdBy,
      sourceMessageId,
      sourceConversationId,
      sourceTimestamp,
      sourceInputType,
      sourceIntent
    } = payload;
    userId = payload.userId;

    if (!userId || !content) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'userId y content son requeridos.' }) 
      };
    }

    // Evitar duplicados cuando viene referencia al mensaje origen.
    if (sourceMessageId) {
      const existingThought = await docClient.query({
        TableName: THOUGHTS_TBL,
        IndexName: THOUGHTS_GSI_USER,
        KeyConditionExpression: 'userId = :u',
        FilterExpression: 'sourceMessageId = :sm',
        ExpressionAttributeValues: {
          ':u': userId,
          ':sm': sourceMessageId
        },
        Limit: 1,
        ScanIndexForward: false
      }).promise();

      if (existingThought.Items && existingThought.Items.length > 0) {
        return {
          statusCode: 200,
          body: JSON.stringify(existingThought.Items[0])
        };
      }
    }

    // Si ya vienen tagIds y tagNames resueltos (desde messageIntentIdentification), usarlos
    // Si no, resolver tags usando TagService
    let tagIds, tagNames;
    if (existingTagIds && existingTagNames) {
      console.log('createThought - Usando tags ya resueltos:', { existingTagIds, existingTagNames });
      tagIds = existingTagIds;
      tagNames = existingTagNames;
    } else {
      console.log('createThought - Resolviendo tags:', tags);
      const resolved = await tagService.parseAndResolveTags(tags, userId);
      tagIds = resolved.tagIds;
      tagNames = resolved.tagNames;
    }

    // Guardar el thought
    const thoughtId = uuidv4();
    const now = new Date().toISOString();
    const item = {
      thoughtId,
      userId,
      content,
      tagIds,
      tagNames,
      tagSource: tagSource || (tags ? 'Manual' : null),
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy || 'Manual',
      lastModifiedBy: createdBy || 'Manual',
      sourceMessageId: sourceMessageId || null,
      sourceConversationId: sourceConversationId || null,
      sourceTimestamp: sourceTimestamp || null,
      sourceInputType: sourceInputType || null,
      sourceIntent: sourceIntent || null
    };
    
    await docClient.put({ TableName: THOUGHTS_TBL, Item: item }).promise();

    // Generar confirmación IA y guardarla como mensaje en el chat
    try {
      const confirmContent = await generateConfirmation(content, tagNames);
      const msgNow = new Date().toISOString();
      await docClient.put({
        TableName: MSG_TABLE,
        Item: {
          conversationId: sourceConversationId || userId,
          timestamp: msgNow,
          messageId: uuidv4(),
          sender: 'IA',
          content: confirmContent,
          inputType: 'text',
          intent: 'thought',
          tagIds: [],
          tagNames: [],
          tagSource: null,
          createdAt: msgNow,
          updatedAt: msgNow,
        },
      }).promise();
    } catch (msgErr) {
      console.warn('createThought - Error al guardar mensaje de confirmación:', msgErr.message);
    }

    return { 
      statusCode: 201, 
      body: JSON.stringify(item) 
    };

  } catch (err) {
    console.error('createThought error:', err);

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
            content: 'Lo siento, hubo un error al guardar tu pensamiento. Intenta de nuevo.',
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
      body: JSON.stringify({ error: 'Error al crear el thought.' }) 
    };
  }
};
