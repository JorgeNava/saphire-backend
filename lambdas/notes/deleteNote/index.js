/**
 * Lambda — deleteNote
 * DELETE /notes/{noteId}
 * 
 * Implementa soft delete por defecto.
 * Query params:
 * - hard: true para eliminación permanente (también elimina archivos S3)
 * - userId: requerido para validación
 * 
 * CURL example:
 * curl -X DELETE "https://{api-id}.execute-api.{region}.amazonaws.com/notes/{noteId}?userId=user-123"
 * curl -X DELETE "https://{api-id}.execute-api.{region}.amazonaws.com/notes/{noteId}?userId=user-123&hard=true"
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const s3 = new AWS.S3({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;
const S3_BUCKET = process.env.AWS_S3_BUCKET_ATTACHMENTS || 'zafira-attachments';

exports.handler = async (event) => {
  try {
    const { noteId } = event.pathParameters;
    const qs = event.queryStringParameters || {};
    const { hard, userId } = qs;

    if (!noteId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El parámetro noteId es requerido.' })
      };
    }

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El query param userId es requerido.' })
      };
    }

    // Obtener la nota para validar ownership y obtener attachments
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
        body: JSON.stringify({ error: 'No tienes permiso para eliminar esta nota.' })
      };
    }

    // Hard delete: eliminación permanente + archivos S3
    if (hard === 'true') {
      // Eliminar archivos de S3 si existen
      if (note.attachmentKeys && note.attachmentKeys.length > 0) {
        await deleteS3Files(note.attachmentKeys);
      }

      // Eliminar de DynamoDB
      await docClient.delete({
        TableName: TABLE_NAME,
        Key: { noteId }
      }).promise();

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: `Nota ${noteId} eliminada permanentemente.`,
          filesDeleted: note.attachmentKeys?.length || 0
        })
      };
    }

    // Soft delete: marcar como eliminada
    const now = new Date().toISOString();
    await docClient.update({
      TableName: TABLE_NAME,
      Key: { noteId },
      UpdateExpression: 'SET deletedAt = :d, deletedBy = :u, updatedAt = :now',
      ExpressionAttributeValues: {
        ':d': now,
        ':u': userId,
        ':now': now
      }
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Nota ${noteId} eliminada (soft delete).`,
        deletedAt: now
      })
    };

  } catch (err) {
    console.error('deleteNote error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al eliminar la nota.' })
    };
  }
};

/**
 * Elimina archivos de S3
 */
async function deleteS3Files(attachmentKeys) {
  if (!attachmentKeys || attachmentKeys.length === 0) return;

  try {
    const deleteParams = {
      Bucket: S3_BUCKET,
      Delete: {
        Objects: attachmentKeys.map(key => ({ Key: key })),
        Quiet: false
      }
    };

    const result = await s3.deleteObjects(deleteParams).promise();
    console.log('S3 files deleted:', result.Deleted?.length || 0);
    
    if (result.Errors && result.Errors.length > 0) {
      console.error('S3 deletion errors:', result.Errors);
    }
  } catch (err) {
    console.error('Error deleting S3 files:', err);
    // No fallar la operación si hay error en S3
  }
}
