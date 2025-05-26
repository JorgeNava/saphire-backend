const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient();

exports.handler = async (event) => {
  try {
    // Parsear body
    const { listId, userId, newItem } = JSON.parse(event.body);
    if (!userId || !listId || !newItem) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Faltan datos: userId, listId y newItem son requeridos',
        }),
      };
    }

    // Construir parámetros para UpdateItem usando alias para "items"
    const params = {
      TableName: process.env.LISTS_TABLE,
      Key: {
        userId: { S: userId },
        listId: { S: listId },
      },
      UpdateExpression: 'SET #items = list_append(if_not_exists(#items, :empty), :it)',
      ExpressionAttributeNames: {
        '#items': 'items',
      },
      ExpressionAttributeValues: {
        ':it':    { L: [{ S: newItem }] },
        ':empty': { L: [] },
      },
      ReturnValues: 'UPDATED_NEW',
    };

    // Ejecutar la actualización
    const res = await client.send(new UpdateItemCommand(params));

    // Extraer lista actualizada
    const updated = res.Attributes.items.L.map(x => x.S);

    return {
      statusCode: 200,
      body: JSON.stringify({ items: updated }),
    };
  } catch (err) {
    console.error('Error al actualizar la lista en DynamoDB:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
};
