// createList.js
// Lambda: createList
// Crea una nueva lista para un usuario y la almacena en DynamoDB
// Runtime: AWS Node.js 18.x

const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  // 1) Validación de body
  console.log('[NAVA] event', event);
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No se recibió un body válido' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'JSON mal formado' }),
    };
  }

  const { userId, name, tags = [], items = [] } = body;

  // 2) Validación de campos requeridos
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'El campo userId es requerido y debe ser un string no vacío' }),
    };
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'El campo name es requerido y debe ser un string no vacío' }),
    };
  }

  // 3) Construcción del ítem a insertar
  const listId    = uuidv4();
  const createdAt = new Date().toISOString();
  const params    = {
    TableName: process.env.LISTS_TABLE,
    Item: {
      userId:    { S: userId },
      listId:    { S: listId },
      name:      { S: name.trim() },
      tags:      { SS: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [] },
      items:     { L: Array.isArray(items) ? items.map(i => ({ S: i.trim() })).filter(o => o.S) : [] },
      createdAt: { S: createdAt },
    },
  };

  // 4) Envío a DynamoDB
  try {
    await client.send(new PutItemCommand(params));
  } catch (dbErr) {
    console.error('Error al guardar la lista en DynamoDB:', dbErr);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno al guardar la lista' }),
    };
  }

  // 5) Respuesta exitosa
  return {
    statusCode: 201,
    body: JSON.stringify({
      listId,
      name: name.trim(),
      tags: params.Item.tags.SS,
      items: params.Item.items.L.map(o => o.S),
      createdAt,
    }),
  };
};
