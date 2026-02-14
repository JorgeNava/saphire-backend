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
      pinned,
      userId
    } = body;

    if (!listId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "El campo listId es requerido."
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

    // Construir UpdateExpression dinámicamente
    const updateParts = [];
    const expressionAttributeNames = {
      '#n': 'name',
      '#it': 'items'
    };
    const expressionAttributeValues = {
      ':u': updatedAt,
      ':lm': userId || 'Manual'
    };

    // Campos opcionales
    if (name !== undefined) {
      updateParts.push('#n = :name');
      expressionAttributeValues[':name'] = name;
    }
    if (items !== undefined) {
      updateParts.push('#it = :items');
      expressionAttributeValues[':items'] = structuredItems;
    }
    updateParts.push('tagIds = :tagIds');
    expressionAttributeValues[':tagIds'] = tagIds;
    updateParts.push('tagNames = :tagNames');
    expressionAttributeValues[':tagNames'] = tagNames;
    updateParts.push('tagSource = :ts');
    expressionAttributeValues[':ts'] = tagSource;
    
    // Agregar pinned si fue proporcionado
    if (pinned !== undefined) {
      updateParts.push('pinned = :pinned');
      expressionAttributeValues[':pinned'] = !!pinned; // Convertir a boolean
    }
    
    updateParts.push('updatedAt = :u');
    updateParts.push('lastModifiedBy = :lm');

    const params = {
      TableName: TABLE_NAME,
      Key: { listId },
      UpdateExpression: 'SET ' + updateParts.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
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
