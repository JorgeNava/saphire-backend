/**
 * Lambda — createNoteFromThought
 * POST /notes/from-thought
 * 
 * Convierte un pensamiento individual en una nota preservando contexto.
 * 
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/notes/from-thought \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "thoughtId":"thought-789",
 *     "title":"Idea importante",
 *     "tags":["ideas"]
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const THOUGHTS_TABLE = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const NOTES_TABLE = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { userId, thoughtId, title, tags } = JSON.parse(event.body);

    // 1. Validar input
    if (!userId || !thoughtId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'userId y thoughtId son requeridos'
        })
      };
    }

    // 2. Obtener pensamiento
    const result = await docClient.get({
      TableName: THOUGHTS_TABLE,
      Key: { thoughtId }
    }).promise();

    const thought = result.Item;

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

    // Verificar ownership
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

    // 3. Generar título si no se proporciona
    const finalTitle = title && title.trim() 
      ? title.trim() 
      : thought.content.substring(0, 50) + (thought.content.length > 50 ? '...' : '');

    // 4. Resolver tags (combinar tags del thought + nuevos)
    const allTags = new Set();
    
    if (thought.tagNames && Array.isArray(thought.tagNames)) {
      thought.tagNames.forEach(tag => allTags.add(tag));
    }
    
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => allTags.add(tag));
    }

    const { tagIds, tagNames } = await tagService.parseAndResolveTags(
      Array.from(allTags), 
      userId
    );

    // 5. Crear nota
    const noteId = uuidv4();
    const timestamp = new Date().toISOString();

    const newNote = {
      noteId,
      userId,
      title: finalTitle,
      content: thought.content,
      attachmentKeys: [],
      tagIds,
      tagNames,
      tagSource: 'Manual',
      sourceType: 'thought',
      sourceThoughtId: thought.thoughtId,
      sourceThoughtCreatedAt: thought.createdAt,
      createdFromThought: true,
      createdAt: timestamp,
      createdBy: userId,
      updatedAt: timestamp,
      lastModifiedBy: userId
    };

    // 6. Guardar nota
    await docClient.put({
      TableName: NOTES_TABLE,
      Item: newNote
    }).promise();

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNote)
    };

  } catch (error) {
    console.error('createNoteFromThought error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al crear la nota desde pensamiento.' })
    };
  }
};
