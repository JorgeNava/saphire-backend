const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const client = new DynamoDBClient();

const predefinedCategories = [
  "ideas",
  "tareas",
  "recordatorios",
  "reflexiones",
  "pendientes",
  "lugares por visitar",
  "sueños",
  "metas",
  "hobbies",
  "programación",
  "musica",
  "sobre mi vida y personalidad",
  "relaciones amorosas",
  "libros por leer"
];

async function classifyWithAI(text) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Eres un clasificador de notas. Las categorías válidas son: ${predefinedCategories.join(", ")}. Si no hay una categoría adecuada, sugiere una nueva en una sola palabra. Solo responde con la categoría.`
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
    throw new Error(`OpenAI API Error: ${data.error?.message || "Unknown error"}`);
  }

  if (!data.choices || !data.choices[0]?.message?.content) {
    console.error("Invalid OpenAI response:", JSON.stringify(data));
    throw new Error("Invalid response structure from OpenAI API");
  }

  return data.choices[0].message.content.trim().toLowerCase();
}

exports.handler = async (event) => {
  const { userId, text, classification } = JSON.parse(event.body);
  const messageId = uuidv4();
  const timestamp = new Date().toISOString();

  let finalClassification = classification;
  let usedAI = false;

  if (!classification || classification.trim() === "") {
    const suggested = await classifyWithAI(text);
    finalClassification = suggested;
    usedAI = true;
  }

  const params = {
    TableName: process.env.DYNAMO_TABLE,
    Item: {
      userId: { S: userId },
      timestamp: { S: timestamp },
      messageId: { S: messageId },
      inputType: { S: "text" },
      originalContent: { S: text },
      classification: { S: finalClassification },
      usedAI: { BOOL: usedAI }
    }
  };

  await client.send(new PutItemCommand(params));

  return {
    statusCode: 200,
    body: JSON.stringify({
      messageId,
      classification: finalClassification
    })
  };
};
