/**
 * Lambda — driveQueryHandler
 * POST /drive/query
 * Maneja consultas sobre archivos de Google Drive usando RAG con OpenAI.
 * 
 * Sub-intents soportados:
 * - list_files: Listar archivos en la carpeta de libros
 * - get_summary: Obtener resumen de un libro específico
 * - search_topic: Buscar libros por tema
 * - get_link: Obtener link a un archivo
 * - compare: Comparar contenido entre libros
 * - general_summary: Resumen general de todos los libros
 * - stats: Estadísticas (cuántos libros, último agregado, etc.)
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { DriveService } = require('/opt/nodejs/driveService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const driveService = new DriveService();

const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const OPENAI_URL = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;
const OPENAI_KEY = process.env.OPENAI_API_KEY_AWS_USE;
const BOOKS_FOLDER_ID = process.env.GOOGLE_DRIVE_BOOKS_FOLDER_ID;

/**
 * Determina el sub-intent de la consulta usando OpenAI
 */
async function classifySubIntent(query) {
  const systemPrompt = `
Eres un clasificador de consultas sobre documentos de Google Drive. Clasifica la consulta y responde SOLO JSON válido.

Sub-intents válidos:
  • list_files    → listar archivos/libros disponibles
  • get_summary   → obtener resumen o contenido de un libro específico
  • search_topic  → buscar libros por tema o concepto
  • get_link      → obtener el link/URL de un archivo
  • compare       → comparar contenido entre múltiples libros
  • general_summary → resumen general de todos los libros
  • stats         → estadísticas (cuántos libros, fechas, etc.)

Si la consulta menciona un libro específico, incluye el nombre aproximado en "target".
Si la consulta menciona un tema, incluye el tema en "topic".

Consulta: "${query}"
Responde en este formato exacto:
{"sub_intent":"...", "target":"...", "topic":"..."}
`;

  const aiRes = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [{ role: 'system', content: systemPrompt }],
      max_tokens: 100,
      temperature: 0,
    }),
  });

  const aiData = await aiRes.json();
  const content = aiData.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { sub_intent: 'list_files' };
  } catch {
    return { sub_intent: 'list_files' };
  }
}

/**
 * Encuentra el archivo más relevante dado un nombre aproximado
 */
function findBestMatch(files, target) {
  if (!target) return null;
  const lower = target.toLowerCase();
  
  // Búsqueda exacta parcial
  let best = files.find(f => f.name.toLowerCase().includes(lower));
  if (best) return best;

  // Búsqueda por palabras clave
  const words = lower.split(/\s+/).filter(w => w.length > 2);
  let maxScore = 0;
  for (const file of files) {
    const fname = file.name.toLowerCase();
    const score = words.filter(w => fname.includes(w)).length;
    if (score > maxScore) {
      maxScore = score;
      best = file;
    }
  }

  return best;
}

/**
 * Genera respuesta con OpenAI usando contexto de los documentos
 */
async function generateResponse(query, context, instruction) {
  const systemPrompt = `
Eres Zafira, un asistente personal inteligente. El usuario te pregunta sobre sus resúmenes de libros guardados en Google Drive.

${instruction}

Contexto de los documentos:
${context}

Responde de forma útil, concisa y en español. Si mencionas libros, incluye su nombre exacto.
Si tienes links, inclúyelos.
`;

  const aiRes = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });

  const aiData = await aiRes.json();
  return aiData.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
}

exports.handler = async (event) => {
  let userId;
  try {
    // Parsear entrada — puede venir del intent router o directo
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else if (event.body) {
      body = event.body;
    } else {
      body = event;
    }

    userId = body.userId;
    const { query, content } = body;
    const userQuery = query || content;

    if (!userId || !userQuery) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'userId y query son requeridos' }),
      };
    }

    // Verificar que el usuario tiene Drive conectado
    const authClient = await driveService.getAuthClient(userId);
    if (!authClient) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: 'No tienes Google Drive conectado. Ve a Configuración > Integraciones para conectar tu cuenta de Google.',
          driveConnected: false,
        }),
      };
    }

    if (!BOOKS_FOLDER_ID) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: 'La carpeta de libros no está configurada. Contacta al administrador.',
          driveConnected: true,
        }),
      };
    }

    // Clasificar sub-intent
    const classification = await classifySubIntent(userQuery);
    const { sub_intent, target, topic } = classification;
    console.log('📚 Drive query classification:', JSON.stringify(classification));

    // Obtener lista de archivos
    const files = await driveService.listFiles(authClient, BOOKS_FOLDER_ID);
    console.log(`📁 ${files.length} archivos encontrados en carpeta de libros`);

    let response;

    switch (sub_intent) {
      case 'list_files': {
        const fileList = files.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
        const context = `Archivos en la carpeta de Libros:\n${fileList}`;
        response = await generateResponse(userQuery, context, 'Lista los libros de forma ordenada y amigable.');
        break;
      }

      case 'get_summary': {
        const file = findBestMatch(files, target);
        if (!file) {
          response = `No encontré un libro que coincida con "${target}" en tu carpeta de Drive. Tus libros disponibles son:\n${files.map(f => `• ${f.name}`).join('\n')}`;
          break;
        }
        const content = await driveService.getFileContent(authClient, file.id);
        const truncated = content.substring(0, 8000);
        const context = `Contenido del resumen "${file.name}":\n${truncated}`;
        response = await generateResponse(userQuery, context, `El usuario pregunta sobre el libro "${file.name}". Responde basándote en el contenido del resumen.`);
        break;
      }

      case 'search_topic': {
        // Leer contenido de todos los archivos y buscar por tema
        const contents = [];
        for (const file of files) {
          try {
            const text = await driveService.getFileContent(authClient, file.id);
            contents.push({ name: file.name, content: text.substring(0, 3000), link: driveService.getFileLink(file.id) });
          } catch (err) {
            console.warn(`No se pudo leer ${file.name}:`, err.message);
          }
        }
        const context = contents.map(c => `--- ${c.name} (${c.link}) ---\n${c.content}`).join('\n\n');
        response = await generateResponse(userQuery, context, `El usuario busca libros sobre el tema "${topic || userQuery}". Identifica cuáles libros hablan sobre ese tema y explica qué dice cada uno.`);
        break;
      }

      case 'get_link': {
        const file = findBestMatch(files, target);
        if (!file) {
          response = `No encontré un libro que coincida con "${target}". Tus libros:\n${files.map(f => `• ${f.name}`).join('\n')}`;
          break;
        }
        const link = file.webViewLink || driveService.getFileLink(file.id);
        response = `📄 **${file.name}**\n🔗 ${link}`;
        break;
      }

      case 'compare': {
        const contents = [];
        for (const file of files) {
          try {
            const text = await driveService.getFileContent(authClient, file.id);
            contents.push({ name: file.name, content: text.substring(0, 3000) });
          } catch (err) {
            console.warn(`No se pudo leer ${file.name}:`, err.message);
          }
        }
        const context = contents.map(c => `--- ${c.name} ---\n${c.content}`).join('\n\n');
        response = await generateResponse(userQuery, context, `El usuario quiere comparar lo que dicen sus libros sobre "${topic || userQuery}". Compara las perspectivas de los diferentes libros.`);
        break;
      }

      case 'general_summary': {
        const contents = [];
        for (const file of files) {
          try {
            const text = await driveService.getFileContent(authClient, file.id);
            contents.push({ name: file.name, content: text.substring(0, 2000) });
          } catch (err) {
            console.warn(`No se pudo leer ${file.name}:`, err.message);
          }
        }
        const context = contents.map(c => `--- ${c.name} ---\n${c.content}`).join('\n\n');
        response = await generateResponse(userQuery, context, 'El usuario quiere un resumen general de todos los libros que ha leído. Resume brevemente cada uno y da una conclusión general.');
        break;
      }

      case 'stats': {
        const sorted = [...files].sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
        const stats = {
          total: files.length,
          lastModified: sorted[0]?.name || 'N/A',
          lastModifiedDate: sorted[0]?.modifiedTime || 'N/A',
          fileList: files.map(f => f.name),
        };
        const context = `Estadísticas:\n- Total de libros: ${stats.total}\n- Último modificado: ${stats.lastModified} (${stats.lastModifiedDate})\n- Lista: ${stats.fileList.join(', ')}`;
        response = await generateResponse(userQuery, context, 'Presenta las estadísticas de forma amigable.');
        break;
      }

      default: {
        const fileList = files.map(f => `• ${f.name}`).join('\n');
        response = await generateResponse(userQuery, `Archivos disponibles:\n${fileList}`, 'Responde la consulta del usuario con la información disponible.');
      }
    }

    console.log('✅ Drive query respondida, sub_intent:', sub_intent);

    // Guardar la respuesta como mensaje de IA en DynamoDB
    const now = new Date().toISOString();
    const iaMessage = {
      conversationId: userId,
      timestamp: now,
      messageId: uuidv4(),
      sender: 'IA',
      content: response,
      inputType: 'text',
      intent: 'drive_query',
      tagIds: [],
      tagNames: [],
      tagSource: null,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.put({
      TableName: MSG_TABLE,
      Item: iaMessage,
    }).promise();

    console.log('💾 Mensaje IA guardado:', iaMessage.messageId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response,
        sub_intent,
        driveConnected: true,
        filesCount: files.length,
        messageId: iaMessage.messageId,
      }),
    };

  } catch (err) {
    console.error('driveQueryHandler error:', err);

    // Guardar mensaje de error en el chat para que el usuario sepa que falló
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
            content: 'Lo siento, hubo un error al consultar tus archivos de Google Drive. Intenta de nuevo en unos momentos.',
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Error al consultar Drive',
        details: err.message,
      }),
    };
  }
};
