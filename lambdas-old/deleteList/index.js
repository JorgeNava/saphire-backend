// deleteList/index.js
const { DynamoDBClient, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient();

/**
 * Lambda: deleteList
 * Elimina una lista completa de DynamoDB.
 * Espera un payload JSON con { userId, listId }.
 *
 * Environment Variables:
 *   LISTS_TABLE — nombre de la tabla DynamoDB
 */
exports.handler = async (event) => {
  try {
    // 1) Parsear cuerpo
    const { userId, listId } = JSON.parse(event.body || '{}');

    // 2) Validar parámetros
    if (!userId || !listId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Se requieren userId y listId' }),
      };
    }

    // 3) Configurar DeleteItem
    const params = {
      TableName: process.env.LISTS_TABLE,
      Key: {
        userId: { S: userId },
        listId: { S: listId },
      },
    };

    // 4) Ejecutar eliminación
    await client.send(new DeleteItemCommand(params));

    // 5) Responder éxito
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lista eliminada correctamente',
        listId,
      }),
    };
  } catch (error) {
    console.error('Error eliminando la lista:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno al eliminar la lista' }),
    };
  }
};
