/**
 * Lambda — addThoughtToNote
 * POST /notes/{noteId}/add-thought
 * 
 * Agrega el contenido de un pensamiento a una nota existente en formato bullet point.
 * 
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/notes/{noteId}/add-thought \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "thoughtId":"thought-789"
 *   }'
 */

const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const NOTES_TABLE = process.env.AWS_DYNAMODB_TABLE_NOTES;
const THOUGHTS_TABLE = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;

exports.handler = async (event) => {
  try {
    const { noteId } = event.pathParameters;
    const { userId, thoughtId } = JSON.parse(event.body);

    // 1. Validar input
    if (!noteId || !userId || !thoughtId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'noteId, userId y thoughtId son requeridos'
        })
      };
    }

    // 2. Obtener la nota
    const noteResult = await docClient.get({
      TableName: NOTES_TABLE,
      Key: { noteId }
    }).promise();

    const note = noteResult.Item;

    if (!note) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'NOTE_NOT_FOUND',
          message: 'Nota no encontrada'
        })
      };
    }

    // Verificar ownership de la nota
    if (note.userId !== userId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'UNAUTHORIZED',
          message: 'No tienes permiso para modificar esta nota'
        })
      };
    }

    // 3. Obtener el pensamiento
    const thoughtResult = await docClient.get({
      TableName: THOUGHTS_TABLE,
      Key: { thoughtId }
    }).promise();

    const thought = thoughtResult.Item;

    if (!thought) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'THOUGHT_NOT_FOUND',
          message: 'Pensamiento no encontrado'
        })
      };
    }

    // Verificar ownership del pensamiento
    if (thought.userId !== userId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'UNAUTHORIZED',
          message: 'No tienes permiso para acceder a este pensamiento'
        })
      };
    }

    // 4. Agregar pensamiento como bullet point al contenido de la nota
    const bulletPoint = `- ${thought.content}`;
    const updatedContent = note.content 
      ? `${note.content}\n${bulletPoint}`
      : bulletPoint;

    // 5. Actualizar la nota
    const updatedAt = new Date().toISOString();
    const updateParams = {
      TableName: NOTES_TABLE,
      Key: { noteId },
      UpdateExpression: 'SET content = :c, updatedAt = :u, lastModifiedBy = :m',
      ExpressionAttributeValues: {
        ':c': updatedContent,
        ':u': updatedAt,
        ':m': userId
      },
      ReturnValues: 'ALL_NEW'
    };

    const updateResult = await docClient.update(updateParams).promise();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Pensamiento agregado exitosamente a la nota',
        note: updateResult.Attributes,
        addedThought: {
          thoughtId: thought.thoughtId,
          content: thought.content
        }
      })
    };

  } catch (error) {
    console.error('addThoughtToNote error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Error al agregar pensamiento a la nota.',
        details: error.message
      })
    };
  }
};
