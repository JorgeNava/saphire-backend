// deleteListItem.js
const {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient();

exports.handler = async (event) => {
  try {
    const { userId, listId, item } = JSON.parse(event.body);
    if (!userId || !listId || !item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Debe proporcionar userId, listId e item' }),
      };
    }

    // 1) Leer la lista actual (alias para "items")
    const getRes = await client.send(new GetItemCommand({
      TableName: process.env.LISTS_TABLE,
      Key: {
        userId: { S: userId },
        listId: { S: listId },
      },
      ProjectionExpression: '#itms',
      ExpressionAttributeNames: {
        '#itms': 'items',
      },
    }));

    const current = getRes.Item?.items?.L?.map(x => x.S) || [];

    // 2) Filtrar el elemento a eliminar (elimina todas las ocurrencias)
    const filtered = current.filter(i => i !== item);

    // 3) Escribir la lista filtrada de vuelta (alias para "items")
    const updateRes = await client.send(new UpdateItemCommand({
      TableName: process.env.LISTS_TABLE,
      Key: {
        userId: { S: userId },
        listId: { S: listId },
      },
      UpdateExpression: 'SET #itms = :newItems',
      ExpressionAttributeNames: {
        '#itms': 'items',
      },
      ExpressionAttributeValues: {
        ':newItems': { L: filtered.map(i => ({ S: i })) },
      },
      ReturnValues: 'UPDATED_NEW',
    }));

    const updated = updateRes.Attributes?.items?.L?.map(x => x.S) || filtered;

    return {
      statusCode: 200,
      body: JSON.stringify({ items: updated }),
    };
  } catch (err) {
    console.error('Error al eliminar elemento de la lista:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
};
