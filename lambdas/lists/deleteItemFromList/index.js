/**
 * Lambda — deleteItemFromList
 * Endpoint para eliminar items de listas
 * Ruta: DELETE /lists/items
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body);
    const { userId, listId, item } = body;

    // Validar parámetros
    if (!userId || !listId || !item) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'MISSING_PARAMETERS',
          message: 'userId, listId e item son requeridos'
        })
      };
    }

    // Obtener la lista
    const getCommand = new GetCommand({
      TableName: LISTS_TABLE,
      Key: { listId }
    });

    const { Item: list } = await docClient.send(getCommand);

    if (!list) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'LIST_NOT_FOUND',
          message: 'Lista no encontrada'
        })
      };
    }

    // Validar ownership
    if (list.userId !== userId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para modificar esta lista'
        })
      };
    }

    // Filtrar el item a eliminar (buscar por content)
    const currentItems = list.items || [];
    const updatedItems = currentItems.filter(i => {
      const itemContent = typeof i === 'string' ? i : i.content;
      return itemContent !== item;
    });

    // Verificar que se eliminó algo
    if (updatedItems.length === currentItems.length) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'ITEM_NOT_FOUND',
          message: 'Item no encontrado en la lista'
        })
      };
    }

    // Reordenar items restantes
    const reorderedItems = updatedItems.map((item, index) => {
      if (typeof item === 'string') {
        return {
          itemId: item.itemId || `legacy-${index}`,
          content: item,
          completed: false,
          order: index
        };
      }
      return {
        ...item,
        order: index
      };
    });

    const now = new Date().toISOString();

    // Actualizar en DynamoDB
    const updateCommand = new UpdateCommand({
      TableName: LISTS_TABLE,
      Key: { listId },
      UpdateExpression: 'SET #items = :items, updatedAt = :updatedAt, lastModifiedBy = :userId',
      ExpressionAttributeNames: {
        '#items': 'items'
      },
      ExpressionAttributeValues: {
        ':items': reorderedItems,
        ':updatedAt': now,
        ':userId': userId
      },
      ReturnValues: 'ALL_NEW'
    });

    const { Attributes: updatedList } = await docClient.send(updateCommand);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Item eliminado exitosamente',
        list: updatedList,
        items: updatedList.items
      })
    };

  } catch (error) {
    console.error('Error deleting item from list:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: error.message
      })
    };
  }
};
