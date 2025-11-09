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
    const { title, content, attachmentKeys = [], tags, userId } = JSON.parse(event.body);

    if (!noteId || !title || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'noteId, title y content son requeridos.' })
      };
    }

    // Resolver tags usando TagService
    const { tagIds, tagNames } = await tagService.parseAndResolveTags(tags, userId || 'Manual');

    const updatedAt = new Date().toISOString();
    const params = {
      TableName: TABLE_NAME,
      Key: { noteId },
      UpdateExpression: 'SET title = :t, content = :c, attachmentKeys = :a, tagIds = :g, tagNames = :tn, tagSource = :ts, updatedAt = :u, lastModifiedBy = :m',
      ExpressionAttributeValues: {
        ':t': title,
        ':c': content,
        ':a': attachmentKeys,
        ':g': tagIds,
        ':tn': tagNames,
        ':ts': tags ? 'Manual' : null,
        ':u': updatedAt,
        ':m': userId || 'Manual'
      },
      ReturnValues: 'ALL_NEW'
    };

    const res = await docClient.update(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(res.Attributes)
    };
  } catch (err) {
    console.error('updateNote error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al actualizar la nota.' })
    };
  }
};
