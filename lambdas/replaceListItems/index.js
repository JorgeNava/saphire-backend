// replaceListItems.js
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient();

exports.handler = async (event) => {
  try {
    const { userId, listId, items } = JSON.parse(event.body);
    if (!userId || !listId || !Array.isArray(items)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Debe proporcionar userId, listId y un array items' }),
      };
    }

    // Prepara la lista en formato DynamoDB
    const dynamoList = items.map(i => ({ S: i }));

    const params = {
      TableName: process.env.LISTS_TABLE,
      Key: {
        userId: { S: userId },
        listId: { S: listId },
      },
      // Usa alias para el atributo reservado "items"
      UpdateExpression: 'SET #itms = :newItems',
      ExpressionAttributeNames: {
        '#itms': 'items',
      },
      ExpressionAttributeValues: {
        ':newItems': { L: dynamoList },
      },
      ReturnValues: 'UPDATED_NEW',
    };

    const res = await client.send(new UpdateItemCommand(params));

    // Extrae el array actualizado
    const updated = res.Attributes['#itms']
      ? res.Attributes['#itms'].L.map(x => x.S)
      : [];

    return {
      statusCode: 200,
      body: JSON.stringify({ items: updated }),
    };
  } catch (err) {
    console.error('Error al reemplazar elementos de la lista:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
};
