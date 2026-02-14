/**
 * Lambda — messageIntentIdentification
 * POST /messages/intent-identification
 * Identifica el intent (thought, list o research) con OpenAI y despacha la Lambda correspondiente.
 */

const AWS   = require('aws-sdk');

const lambda      = new AWS.Lambda({ region: process.env.AWS_REGION });
const OPENAI_URL  = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY  = process.env.OPENAI_API_KEY_AWS_USE;
const THOUGHT_LAMBDA = process.env.LAMBDA_NAME_CREATE_THOUGHT;

// Mapeo de intent → Lambda a invocar
const DISPATCH = {
  list:     process.env.LAMBDA_NAME_CREATE_LIST_THROUGH_AI,
  research: process.env.LAMBDA_NAME_PERFORM_RESEARCH
};

const VALID_INTENTS = new Set(['thought', 'list', 'research', 'order']);

function normalizeIntent(rawIntent) {
  const normalized = String(rawIntent || '').trim().toLowerCase();
  return VALID_INTENTS.has(normalized) ? normalized : 'thought';
}

function inferMessageType(intent) {
  return intent === 'thought' ? 'thought' : 'order';
}

exports.handler = async (event) => {
  try {
    const payload = typeof event === 'string'
      ? JSON.parse(event)
      : event || {};

    const {
      sender,
      content,
      tagIds,
      tagNames,
      tagSource,
      messageId,
      conversationId,
      timestamp,
      inputType
    } = payload;

    if (!sender || !content) {
      return { statusCode: 400, body: JSON.stringify({ error: 'sender y content son requeridos.' }) };
    }
    
    console.log('messageIntentIdentification - Tags recibidos:', { tagIds, tagNames, tagSource });

    // 1) Determinar intent con OpenAI
    const systemPrompt = `
Eres un detector de intención de mensajes. Clasifica el mensaje y responde SOLO JSON válido.

Intentos válidos:
  • thought   → pensamiento personal que debe guardarse.
  • list      → petición para crear/actualizar listas.
  • research  → petición de investigación o reporte.
  • order     → orden/comando accionable que no cae en list o research.

Mensaje: "${content}"
Responde en este formato exacto:
{"intent":"thought|list|research|order"}
`;

    const aiRes = await fetch(OPENAI_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model:    'gpt-4-turbo',
        messages: [{ role: 'system', content: systemPrompt }],
        max_tokens: 40,
        temperature: 0
      })
    });

    const aiData = await aiRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';
    let intent = 'thought';

    try {
      const jsonMatch = String(aiContent).match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      intent = normalizeIntent(parsed.intent);
    } catch (parseErr) {
      console.warn('messageIntentIdentification - Respuesta IA no parseable, usando thought:', aiContent);
      intent = 'thought';
    }

    const messageType = inferMessageType(intent);

    // 2) Solo crear thought si el intent identificado es 'thought'
    if (intent === 'thought' && THOUGHT_LAMBDA) {
      const thoughtPayload = {
        userId: sender,
        content,
        createdBy: 'IA',
        sourceMessageId: messageId,
        sourceConversationId: conversationId,
        sourceTimestamp: timestamp,
        sourceInputType: inputType,
        sourceIntent: intent
      };

      if (tagIds && tagIds.length > 0) {
        thoughtPayload.tags = tagNames;
        thoughtPayload.tagIds = tagIds;
        thoughtPayload.tagNames = tagNames;
        thoughtPayload.tagSource = tagSource;
      }

      await lambda.invoke({
        FunctionName: THOUGHT_LAMBDA,
        InvocationType: 'Event',
        Payload: JSON.stringify(thoughtPayload)
      }).promise();
    }

    // 3) Si el intent es accionable, despachar la Lambda específica
    const targetFn = DISPATCH[intent];
    if (targetFn) {
      const actionPayload = {
        userId: sender,
        content,
        createdBy: 'IA'
      };

      await lambda.invoke({
        FunctionName: targetFn,
        InvocationType: 'Event',
        // createListThroughAI / performResearch esperan formato API Gateway
        Payload: JSON.stringify({ body: JSON.stringify(actionPayload) })
      }).promise();
    }

    // 4) Devolver clasificación al caller
    return {
      statusCode: 200,
      body: JSON.stringify({ intent, messageType })
    };

  } catch (err) {
    console.error('messageIntentIdentification error:', err);
    // En caso de fallo, devolvemos clasificación por defecto
    return {
      statusCode: 200,
      body: JSON.stringify({ intent: 'thought', messageType: 'thought' })
    };
  }
};
