/**
 * Lambda — restoreNote
 * POST /notes/{noteId}/restore
 * 
 * Restaura una nota eliminada (soft delete)
 * 
 * Query params:
 * - userId: requerido para validación
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { noteId } = event.pathParameters;
    const qs = event.queryStringParameters || {};
    const { userId } = qs;

    if (!noteId || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'noteId y userId son requeridos.' })
      };
    }

    // Obtener la nota
    const getResult = await docClient.get({
      TableName: TABLE_NAME,
      Key: { noteId }
    }).promise();

    if (!getResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Nota no encontrada.' })
      };
    }

    const note = getResult.Item;

    // Validar ownership
    if (note.userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'No tienes permiso para restaurar esta nota.' })
      };
    }

    // Verificar que esté eliminada
    if (!note.deletedAt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'La nota no está eliminada.' })
      };
    }

    // Restaurar: eliminar campos deletedAt y deletedBy
    const now = new Date().toISOString();
    await docClient.update({
      TableName: TABLE_NAME,
      Key: { noteId },
      UpdateExpression: 'REMOVE deletedAt, deletedBy SET updatedAt = :now',
      ExpressionAttributeValues: {
        ':now': now
      }
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Nota ${noteId} restaurada exitosamente.`,
        restoredAt: now
      })
    };

  } catch (err) {
    console.error('restoreNote error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al restaurar la nota.' })
    };
  }
};
