/**
 * Lambda — updateNote
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/notes/{noteId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "title":"Título actualizado",
 *     "content":"Contenido modificado",
 *     "attachmentKeys":["nuevo.pdf"],  // opcional
 *     "tagIds":["tag1","tag3"]         // opcional
 *   }'
 */

const AWS = require('aws-sdk');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { noteId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { 
      title, 
      content, 
      attachmentKeys = [], 
      tags,           // Formato antiguo (array de strings o IDs)
      tagNames,       // Formato nuevo del frontend (array de strings)
      tagSource,
      pinned,
      userId 
    } = body;

    if (!noteId || !userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'noteId y userId son requeridos.' })
      };
    }

    if (!title || !content) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'title y content son requeridos.' })
      };
    }

    // Resolver tags usando TagService
    // Soportar tanto 'tags' como 'tagNames' del frontend
    const tagsToProcess = tagNames || tags || [];
    const { tagIds, tagNames: resolvedTagNames } = await tagService.parseAndResolveTags(
      tagsToProcess, 
      userId
    );

    const updatedAt = new Date().toISOString();
    
    // Construir UpdateExpression dinámicamente
    const updateParts = [
      'title = :t',
      'content = :c',
      'attachmentKeys = :a',
      'tagIds = :g',
      'tagNames = :tn',
      'tagSource = :ts',
      'updatedAt = :u',
      'lastModifiedBy = :m'
    ];
    
    const expressionAttributeValues = {
      ':t': title,
      ':c': content,
      ':a': attachmentKeys,
      ':g': tagIds,
      ':tn': resolvedTagNames,
      ':ts': tagSource || (tagsToProcess.length > 0 ? 'Manual' : null),
      ':u': updatedAt,
      ':m': userId
    };
    
    // Agregar pinned si fue proporcionado
    if (pinned !== undefined) {
      updateParts.push('pinned = :pinned');
      expressionAttributeValues[':pinned'] = !!pinned;
    }
    
    const params = {
      TableName: TABLE_NAME,
      Key: { noteId },
      UpdateExpression: 'SET ' + updateParts.join(', '),
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const res = await docClient.update(params).promise();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(res.Attributes)
    };
  } catch (err) {
    console.error('updateNote error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Error al actualizar la nota.',
        details: err.message
      })
    };
  }
};
