/**
 * Lambda — createNote
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/notes \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "title":"Mi primera nota",
 *     "content":"Contenido de la nota",
 *     "attachmentKeys":["file1.png","file2.pdf"],   // opcional
 *     "tagIds":["tag1","tag2"]                      // opcional
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { userId, title, content, attachmentKeys = [], tags, pinned = false } = JSON.parse(event.body);
    if (!userId || !title || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId, title y content son requeridos.' })
      };
    }

    // Resolver tags usando TagService
    const { tagIds, tagNames } = await tagService.parseAndResolveTags(tags, userId);

    const noteId = uuidv4();
    const timestamp = new Date().toISOString();
    const item = {
      noteId,
      userId,
      title,
      content,
      attachmentKeys,
      tagIds,
      tagNames,
      tagSource: tags ? 'Manual' : null,
      pinned: !!pinned,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: userId,
      lastModifiedBy: userId
    };

    await docClient.put({
      TableName: TABLE_NAME,
      Item: item
    }).promise();

    return {
      statusCode: 201,
      body: JSON.stringify(item)
    };
  } catch (err) {
    console.error('createNote error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear la nota.' })
    };
  }
};
