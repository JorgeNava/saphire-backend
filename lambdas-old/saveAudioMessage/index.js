/**
 * Lambda: saveAudioMessage
 * Guarda un mensaje de audio: transcribe, clasifica, almacena en DynamoDB y borra el audio de S3
 * Runtime: AWS Node.js 18.x
 */

const {
  DynamoDBClient,
  PutItemCommand,
} = require('@aws-sdk/client-dynamodb');
const {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const FormData = require('form-data');

const REGION          = process.env.AWS_REGION || 'us-east-1';
const DYNAMO_TABLE    = process.env.DYNAMO_TABLE;
const AUDIO_BUCKET    = process.env.AUDIO_BUCKET;
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;

if (!DYNAMO_TABLE || !AUDIO_BUCKET || !OPENAI_API_KEY) {
  throw new Error(
    'Environment variables DYNAMO_TABLE, AUDIO_BUCKET and OPENAI_API_KEY must be defined.'
  );
}

const dynamo = new DynamoDBClient({ region: REGION });
const s3     = new S3Client({ region: REGION });

const predefinedCategories = [
  "libros por leer",
  "programación",
  "musica",
  "sobre mi vida y personalidad",
  "relaciones amorosas",
  "lugares por visitar",
  "sueños",
  "metas",
  "reflexiones",
  "hobbies",
  "ideas",
  "recordatorios",
  "pendientes",
  "tareas"
];

async function classifyWithAI(text) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Eres un clasificador de notas. Las categorías válidas son: ${predefinedCategories.join(
            ", "
          )}. Si no hay una categoría adecuada, sugiere una nueva en una sola palabra. Solo responde con la categoría.`
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 10
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("OpenAI API error:", data);
    throw new Error(
      `OpenAI API Error: ${data.error?.message || "Unknown error"}`
    );
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.error("Invalid OpenAI response:", JSON.stringify(data));
    throw new Error("Invalid response structure from OpenAI API");
  }
  return content.trim().toLowerCase();
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

exports.handler = async (event) => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Empty request body" })
      };
    }

    const { userId, s3Key, classification } = JSON.parse(event.body);
    if (!userId || !s3Key) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing userId or s3Key" })
      };
    }

    // 1. Descargar audio desde S3
    const getObj = await s3.send(
      new GetObjectCommand({ Bucket: AUDIO_BUCKET, Key: s3Key })
    );
    const audioBuffer = await streamToBuffer(getObj.Body);

    // 2. Transcribir con Whisper (OpenAI)
    const form = new FormData();
    form.append("file", audioBuffer, s3Key);
    form.append("model", "whisper-1");

    const transcriptionRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: form
      }
    );
    const transcriptionData = await transcriptionRes.json();
    if (!transcriptionRes.ok) {
      console.error("Whisper API error:", transcriptionData);
      throw new Error(
        `Whisper API Error: ${transcriptionData.error?.message || "Unknown"}`
      );
    }
    const text = transcriptionData.text.trim();

    // 3. Clasificar (si no viene classification en la petición)
    let finalClassification = classification;
    let usedAI = false;
    if (!classification || classification.trim() === "") {
      finalClassification = await classifyWithAI(text);
      usedAI = true;
    }

    // 4. Guardar en DynamoDB
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const params = {
      TableName: DYNAMO_TABLE,
      Item: {
        userId:          { S: userId },
        timestamp:       { S: timestamp },
        messageId:       { S: messageId },
        inputType:       { S: "audio" },
        originalContent: { S: text },
        classification:  { S: finalClassification },
        usedAI:          { BOOL: usedAI }
      }
    };
    await dynamo.send(new PutItemCommand(params));

    // 5. Borrar objeto de S3 tras guardar en DynamoDB
    await s3.send(new DeleteObjectCommand({
      Bucket: AUDIO_BUCKET,
      Key:    s3Key
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        messageId,
        classification: finalClassification,
        s3Key,
        transcription: text
      })
    };
  } catch (err) {
    console.error("Error saving audio message:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};
