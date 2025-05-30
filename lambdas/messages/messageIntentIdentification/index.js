/**
 * Lambda — messageIntentIdentification
 * POST /messages/intent-identification
 * Identifica el intent (thought, list o research) con OpenAI y despacha la Lambda correspondiente.
 */

const AWS   = require('aws-sdk');

const lambda      = new AWS.Lambda({ region: process.env.AWS_REGION });
const OPENAI_URL  = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY  = process.env.OPENAI_API_KEY_AWS_USE;

// Mapeo de intent → Lambda a invocar
const DISPATCH = {
  thought:  process.env.LAMBDA_NAME_CREATE_THOUGHT,
  list:     process.env.LAMBDA_NAME_CREATE_LIST_THROUGH_AI,
  research: process.env.LAMBDA_NAME_PERFORM_RESEARCH
};

exports.handler = async (event) => {
  try {
    const { sender, content } = JSON.parse(event.body || '{}');
    if (!sender || !content) {
      return { statusCode: 400, body: JSON.stringify({ error: 'sender y content son requeridos.' }) };
    }

    // 1) Determinar intent con OpenAI
    const systemPrompt = `
Eres un detector de intención de mensajes. Debes devolver exactamente uno de estos tokens:
  • thought   → registra datos sobre la vida del usuario como un segundo cerebro.
  • list      → mensajes que crean o modifican listas de tareas o compras.
  • research  → consultas que requieren investigación y compilación de información.
Mensaje: "${content}"
Respuesta SÓLO con uno de los tokens: thought, list o research.
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
        max_tokens: 1
      })
    });
    const aiData = await aiRes.json();
    let token   = (aiData.choices?.[0]?.message?.content || 'thought').trim().toLowerCase();
    if (!['thought','list','research'].includes(token)) token = 'thought';

    // 2) Despachar la Lambda correspondiente de forma asíncrona
    const targetFn = DISPATCH[token];
    if (targetFn) {
      await lambda.invoke({
        FunctionName:   targetFn,
        InvocationType: 'Event',
        Payload:        JSON.stringify({
          userId: sender,
          content,
          createdBy: 'IA'
        })
      }).promise();
    }

    // 3) Devolver el intent
    return {
      statusCode: 200,
      body:       JSON.stringify({ intent: token })
    };

  } catch (err) {
    console.error('messageIntentIdentification error:', err);
    // En caso de fallo, devolvemos "thought" por defecto
    return {
      statusCode: 200,
      body:       JSON.stringify({ intent: 'thought' })
    };
  }
};
