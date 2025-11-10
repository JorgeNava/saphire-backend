/**
 * Lambda — addItemToListV2
 * Endpoint alternativo para agregar items a listas
 * Ruta: PATCH /lists/items
 * 
 * Este endpoint acepta el listId en el body en lugar de path parameters
 * para compatibilidad con el frontend
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body);
    const { userId, listId, newItem } = body;

    // Validar parámetros requeridos
    if (!userId || !listId || !newItem) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'MISSING_PARAMETERS',
          message: 'userId, listId y newItem son requeridos'
        })
      };
    }

    // Obtener la lista para validar ownership
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

    // Crear nuevo item
    const itemId = uuidv4();
    const now = new Date().toISOString();
    const currentItems = list.items || [];
    
    const newItemObj = {
      itemId,
      content: newItem.trim(),
      completed: false,
      order: currentItems.length,
      createdAt: now
    };

    // Agregar item al array
    const updatedItems = [...currentItems, newItemObj];

    // Actualizar en DynamoDB
    const updateCommand = new UpdateCommand({
      TableName: LISTS_TABLE,
      Key: { listId },
      UpdateExpression: 'SET #items = :items, updatedAt = :updatedAt, lastModifiedBy = :userId',
      ExpressionAttributeNames: {
        '#items': 'items'
      },
      ExpressionAttributeValues: {
        ':items': updatedItems,
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
        message: 'Item agregado exitosamente',
        list: updatedList,
        items: updatedList.items
      })
    };

  } catch (error) {
    console.error('Error adding item to list:', error);
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
