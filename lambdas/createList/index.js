// createList.js
// Lambda: createList
// Crea una nueva lista para un usuario y la almacena en DynamoDB
// Runtime: AWS Node.js 18.x

const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  // 1) Obtener payload ya sea de event.body (string) o directamente de event (objeto)
  let payload;
  if (event.body && typeof event.body === 'string') {
    try {
      payload = JSON.parse(event.body);
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'JSON mal formado en el body' }),
      };
    }
  } else {
    payload = event;
  }

  const { userId, name, tags = [], items = [] } = payload;

  // 2) Validaciones
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

  // 3) Construcción del item a guardar
  const listId    = uuidv4();
  const createdAt = new Date().toISOString();
  const params    = {
    TableName: process.env.LISTS_TABLE,
    Item: {
      userId:    { S: userId.trim() },
      listId:    { S: listId },
      name:      { S: name.trim() },
      tags:      { SS: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [] },
      items:     { L: Array.isArray(items) ? items.map(i => ({ S: i.trim() })).filter(o => o.S) : [] },
      createdAt: { S: createdAt },
    },
  };

  // 4) Guardar en DynamoDB
  try {
    await client.send(new PutItemCommand(params));
  } catch (dbErr) {
    console.error('Error al guardar la lista en DynamoDB:', dbErr);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno al guardar la lista' }),
    };
  }

  // 5) Responder al cliente
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
