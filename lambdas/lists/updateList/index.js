/**
 * Lambda — updateList
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/lists/{listId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "name":"Nombre actualizado",
 *     "items":["itemA","itemB"],
 *     "tagIds":["tagX"],
 *     "tagSource":"IA"
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient();
const tagService = new TagService();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;

exports.handler = async (event) => {
  try {
    const { listId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const {
      name,
      items = [],
      tags,
      tagIds: inputTagIds,
      tagNames: inputTagNames,
      tagSource: inputTagSource,
      userId
    } = body;

    if (!listId || !name) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Los campos listId y name son requeridos."
        })
      };
    }

    // Resolver tags: si vienen tagIds/tagNames directamente, usarlos; sino usar TagService
    let tagIds, tagNames, tagSource;
    
    if (inputTagIds && inputTagNames) {
      // Usuario envió tagIds y tagNames directamente
      tagIds = inputTagIds;
      tagNames = inputTagNames;
      tagSource = inputTagSource || 'Manual';
    } else if (tags) {
      // Usuario envió tags para resolver con TagService
      const resolved = await tagService.parseAndResolveTags(tags, userId || 'Manual');
      tagIds = resolved.tagIds;
      tagNames = resolved.tagNames;
      tagSource = 'Manual';
    } else {
      // Sin tags
      tagIds = [];
      tagNames = [];
      tagSource = null;
    }

    const updatedAt = new Date().toISOString();

    // Estandarizamos los items: si vienen como strings, les asignamos un itemId nuevo
    const structuredItems = items.map(i =>
      typeof i === 'string'
        ? { itemId: uuidv4(), content: i }
        : { itemId: i.itemId || uuidv4(), content: i.content }
    );

    const params = {
      TableName: TABLE_NAME,
      Key: { listId },

      // Usamos alias porque "items" es palabra reservada en DynamoDB UpdateExpression
      UpdateExpression: 'SET #n = :name, #it = :items, tagIds = :tagIds, tagNames = :tagNames, tagSource = :ts, updatedAt = :u, lastModifiedBy = :lm',

      ExpressionAttributeNames: {
        '#n': 'name',
        '#it': 'items'
      },

      ExpressionAttributeValues: {
        ':name': name,
        ':items': structuredItems,
        ':tagIds': tagIds,
        ':tagNames': tagNames,
        ':ts': tagSource,
        ':u': updatedAt,
        ':lm': userId || 'Manual'
      },

      ReturnValues: 'ALL_NEW'
    };

    const result = await docClient.update(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(result.Attributes)
    };

  } catch (error) {
    console.error("updateList error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al actualizar la lista." })
    };
  }
};
