/**
 * Lambda — messageIntentIdentification
 * Identifica el intent con OpenAI y despacha la Lambda correspondiente.
 */

const AWS   = require('aws-sdk');
const fetch = require('node-fetch');

const lambda    = new AWS.Lambda({ region: process.env.AWS_REGION });
const OPENAI_URL = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY = process.env.OPENAI_API_KEY_AWS_USE;

// Mapeo de intent → Lambda a ejecutar
const DISPATCH = {
  thought:  process.env.LAMBDA_NAME_CREATE_THOUGHT,
  list:     process.env.LAMBDA_NAME_CREATE_LIST_THROUGH_AI,
  research: process.env.LAMBDA_NAME_PERFORM_RESEARCH
};

exports.handler = async (event) => {
  try {
    const { sender, content } = event;

    // 1) Preguntar a OpenAI por el intent (solo un token)
    const systemPrompt = `
Eres un detector de intención de mensajes. Debes devolver exactamente uno de estos tokens:
  • thought   → funciona como un “segundo cerebro”: registra datos sobre la vida del usuario o cualquier experiencia, para llevar un registro y poder recordarlo con facilidad.
  • list      → cuando el mensaje solicita o modifica una lista (añadir, eliminar ítems, crear lista de tareas, compras, etc.).
  • research  → cuando el mensaje es una consulta para investigar un tema y recopilar información (definiciones, datos, estudios, etc.).

Mensaje a analizar: "${content}"
Respuesta SÓLO con uno de los tokens: thought, list o research.
`;
    const resp = await fetch(OPENAI_URL, {
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
    const data  = await resp.json();
    const token = (data.choices?.[0]?.message?.content || 'thought')
                    .trim()
                    .toLowerCase();
    const intent = ['thought','list','research'].includes(token) ? token : 'thought';

    // 2) Despachar la Lambda correspondiente de forma asíncrona
    const targetFn = DISPATCH[intent];
    if (targetFn) {
      await lambda.invoke({
        FunctionName:   targetFn,
        InvocationType: 'Event',
        Payload:        JSON.stringify({ userId: sender, content })
      }).promise();
    }

    // 3) Devolver el intent a createMessage
    return {
      statusCode: 200,
      body:       JSON.stringify({ intent })
    };

  } catch (err) {
    console.error('messageIntentIdentification error:', err);
    // En caso de fallo, devolvemos 'thought' por defecto
    return {
      statusCode: 200,
      body:       JSON.stringify({ intent: 'thought' })
    };
  }
};
