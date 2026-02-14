/**
 * Lambda — updateThought
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/thoughts/{thoughtId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "content":"Contenido actualizado",
 *     "tags":["Trabajo","Urgente"]
 *   }'
 * 
 * También acepta tags pre-resueltos:
 *   -d '{
 *     "content":"Contenido actualizado",
 *     "tagIds":["uuid-1","uuid-2"],
 *     "tagNames":["Trabajo","Urgente"],
 *     "tagSource":"Manual"
 *   }'
 */

const AWS = require('aws-sdk');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;

exports.handler = async (event) => {
  try {
    const { thoughtId } = event.pathParameters;
    const { content, tags, tagIds: directTagIds, tagNames: directTagNames, tagSource, userId } = JSON.parse(event.body);

    if (!thoughtId || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'thoughtId y content son requeridos.' })
      };
    }

    // Resolver tags: si vienen tagIds/tagNames directamente, usarlos; sino usar TagService
    let tagIds, tagNames, finalTagSource;
    
    if (directTagIds && directTagNames) {
      // Cliente envió tagIds y tagNames directamente (ya resueltos)
      tagIds = directTagIds;
      tagNames = directTagNames;
      finalTagSource = tagSource || 'Manual';
      console.log('updateThought - Usando tags pre-resueltos:', { tagIds, tagNames });
    } else if (tags) {
      // Cliente envió tags para resolver con TagService
      if (!userId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'userId es requerido cuando se envían tags sin resolver.' })
        };
      }
      const resolved = await tagService.parseAndResolveTags(tags, userId);
      tagIds = resolved.tagIds;
      tagNames = resolved.tagNames;
      finalTagSource = 'Manual';
      console.log('updateThought - Tags resueltos por TagService:', { tags, tagIds, tagNames });
    } else {
      // Sin tags
      tagIds = [];
      tagNames = [];
      finalTagSource = null;
      console.log('updateThought - Sin tags');
    }

    const timestamp = new Date().toISOString();
    const params = {
      TableName: THOUGHTS_TBL,
      Key: { thoughtId },
      UpdateExpression: 'SET content = :c, tagIds = :t, tagNames = :tn, tagSource = :s, updatedAt = :u, lastModifiedBy = :m',
      ExpressionAttributeValues: {
        ':c': content,
        ':t': tagIds,
        ':tn': tagNames,
        ':s': finalTagSource,
        ':u': timestamp,
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
    console.error('updateThought error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al actualizar el thought.' })
    };
  }
};
