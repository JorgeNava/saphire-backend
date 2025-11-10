/**
 * Lambda — updateListItem
 * PUT /lists/{listId}/items/{itemId}
 * 
 * Actualiza un item específico de una lista (principalmente para toggle completed).
 * 
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId}/items/{itemId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "completed":true
 *   }'
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { listId, itemId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { userId, completed, content } = body;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'userId es requerido' })
      };
    }

    // 1. Obtener la lista actual
    const getResult = await docClient.get({
      TableName: LISTS_TABLE,
      Key: { listId }
    }).promise();

    const list = getResult.Item;

    if (!list) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Lista no encontrada' })
      };
    }

    // Verificar ownership
    if (list.userId !== userId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No tienes permiso para modificar esta lista' })
      };
    }

    // 2. Encontrar y actualizar el item
    const itemIndex = list.items.findIndex(i => i.itemId === itemId);

    if (itemIndex === -1) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Item no encontrado en la lista' })
      };
    }

    // Actualizar el item (solo los campos proporcionados)
    // Si el item no tiene 'completed', agregarlo con valor por defecto
    const currentItem = list.items[itemIndex];
    const updatedItem = {
      ...currentItem,
      // Asegurar que completed existe (para items antiguos sin este campo)
      completed: currentItem.completed !== undefined ? currentItem.completed : false
    };

    // Actualizar campos proporcionados
    if (completed !== undefined) {
      updatedItem.completed = completed;
    }

    if (content !== undefined) {
      updatedItem.content = content;
    }

    list.items[itemIndex] = updatedItem;

    // 3. Actualizar la lista en DynamoDB
    const timestamp = new Date().toISOString();
    const updateResult = await docClient.update({
      TableName: LISTS_TABLE,
      Key: { listId },
      UpdateExpression: 'SET #items = :items, updatedAt = :updatedAt, lastModifiedBy = :userId',
      ExpressionAttributeNames: {
        '#items': 'items'  // Escapar palabra reservada
      },
      ExpressionAttributeValues: {
        ':items': list.items,
        ':updatedAt': timestamp,
        ':userId': userId
      },
      ReturnValues: 'ALL_NEW'
    }).promise();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateResult.Attributes)
    };

  } catch (error) {
    console.error('updateListItem error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al actualizar el item' })
    };
  }
};
