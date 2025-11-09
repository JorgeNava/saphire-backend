/**
 * Lambda — createMessageFromAudio
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/messages/audio \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "conversationId":"conv123",
 *     "sender":"user123",
 *     "s3Key":"<clave-generada>",
 *     // opcional: "tagIds":["tag1"]
 *   }'
 */

const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const FormData     = require('form-data');
const axios        = require('axios');
const AWS          = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const s3       = new S3Client({ region: process.env.AWS_REGION });
const docClient= new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const TAGS_TABLE= process.env.AWS_DYNAMODB_TABLE_TAGS;
const OPENAI_API_TRANSCRIPTION_ENDPOINT = `${process.env.OPENAI_API_BASE_URL}/v1/audio/transcriptions`;
const OPENAI_API_CHAT_ENDPOINT = `${process.env.OPENAI_API_BASE_URL}/v1/chat/completions`;

const OPENAI_KEY= process.env.OPENAI_API_KEY_AWS_USE;

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

async function transcribe(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, filename);
  form.append('model','whisper-1');
  
  const response = await axios.post(
    OPENAI_API_TRANSCRIPTION_ENDPOINT,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    }
  );
  
  return response.data.text.trim();
}

async function classifyTags(text, sender, existingNames) {
  const resp = await fetch(OPENAI_API_CHAT_ENDPOINT , {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      Authorization:`Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model:'gpt-4-turbo',
      messages:[
        { role:'system',
          content:`Eres un clasificador de etiquetas para mensajes de ${sender}.  
Las etiquetas existentes son: ${existingNames.join(', ')}.  
Si ninguna aplica, sugiere hasta dos nuevas en una sola palabra, separadas por coma.  
Solo responde con nombres separados por comas.` 
        },
        { role:'user', content:text }
      ],
      max_tokens:20
    })
  });
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content.split(',')
    .map(s=>s.trim().toLowerCase())
    .filter(Boolean);
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const conversationId = body.conversationId || body.userId; // Aceptar userId como conversationId
    const { sender, s3Key, tagIds, tagNames } = body;
    
    if (!conversationId || !sender || !s3Key) {
      return { statusCode:400,
        body: JSON.stringify({ error:'conversationId (o userId), sender y s3Key son requeridos.' }) };
    }

    // 1) bajar audio
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: process.env.AWS_S3_MESSAGE_ATTACHMENTS_BUCKET, Key: s3Key })
    );
    const buffer = await streamToBuffer(obj.Body);

    // 2) transcribir
    const text = await transcribe(buffer, s3Key);

    // 3) Resolver tags si se proporcionan (usar tagIds, tagNames, o tags del input)
    const tagsToResolve = tagIds || tagNames || body.tags;
    let finalTagIds = [];
    let finalTagNames = [];
    let tagSource = null;
    let usedAI = false;
    let createdBy = sender;
    
    if (tagsToResolve && (Array.isArray(tagsToResolve) && tagsToResolve.length > 0)) {
      // Usuario proporcionó tags manualmente
      const resolved = await tagService.parseAndResolveTags(tagsToResolve, sender);
      finalTagIds = resolved.tagIds;
      finalTagNames = resolved.tagNames;
      tagSource = 'Manual';
    } else {
      // No hay tags manuales, usar IA para clasificar
      const tagsData = await docClient.scan({
        TableName: TAGS_TABLE,
        ProjectionExpression:'tagId,#name',
        ExpressionAttributeNames: {
          '#name': 'name'
        }
      }).promise();
      const existing = tagsData.Items || [];
      const names = existing.map(t=>t.name);
      
      const chosen = await classifyTags(text, sender, names);
      finalTagIds = existing
        .filter(t => chosen.includes(t.name.toLowerCase()))
        .map(t => t.tagId);
      finalTagNames = existing
        .filter(t => chosen.includes(t.name.toLowerCase()))
        .map(t => t.name);
      tagSource = 'AI';
      usedAI = true;
      createdBy = 'AI';
    }

    // 5) guardar en DynamoDB
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const item = {
      conversationId,
      timestamp,
      messageId,
      sender,
      content: text,
      originalContent: text,
      inputType:'audio',
      s3Key,
      transcription: text,
      createdAt: timestamp,
      updatedAt: timestamp,
      tagIds: finalTagIds,
      tagNames: finalTagNames,
      tagSource,
      usedAI,
      createdBy,
      lastModifiedBy: createdBy
    };

    await docClient.put({
      TableName: MSG_TABLE,
      Item: item
    }).promise();

    // 6) opcionalmente borrar el audio
    if (process.env.APP_FEATURE_FLAG_DELETE_AUDIO_AFTER_TRANSCRIBE === 'true') {
      await s3.send(
        new DeleteObjectCommand({ Bucket: process.env.AWS_S3_MESSAGE_ATTACHMENTS_BUCKET, Key: s3Key })
      );
    }

    return { statusCode:201, body: JSON.stringify(item) };
  } catch (err) {
    console.error(err);
    return { statusCode:500,
      body: JSON.stringify({ error:'Error al guardar mensaje de audio.' }) };
  }
};
