/**
 * Lambda — createThought
 * POST /thoughts
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const THOUGHTS_GSI_USER = 'GSI-userThoughts';

exports.handler = async (event) => {
  try {
    // Parse payload (API Gateway vs SDK invoke)
    let payload;
    if (typeof event.body === 'string') {
      payload = JSON.parse(event.body);
    } else {
      payload = event;
    }
    const {
      userId,
      content,
      tags,
      tagIds: existingTagIds,
      tagNames: existingTagNames,
      tagSource,
      createdBy,
      sourceMessageId,
      sourceConversationId,
      sourceTimestamp,
      sourceInputType,
      sourceIntent
    } = payload;

    if (!userId || !content) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'userId y content son requeridos.' }) 
      };
    }

    // Evitar duplicados cuando viene referencia al mensaje origen.
    if (sourceMessageId) {
      const existingThought = await docClient.query({
        TableName: THOUGHTS_TBL,
        IndexName: THOUGHTS_GSI_USER,
        KeyConditionExpression: 'userId = :u',
        FilterExpression: 'sourceMessageId = :sm',
        ExpressionAttributeValues: {
          ':u': userId,
          ':sm': sourceMessageId
        },
        Limit: 1,
        ScanIndexForward: false
      }).promise();

      if (existingThought.Items && existingThought.Items.length > 0) {
        return {
          statusCode: 200,
          body: JSON.stringify(existingThought.Items[0])
        };
      }
    }

    // Si ya vienen tagIds y tagNames resueltos (desde messageIntentIdentification), usarlos
    // Si no, resolver tags usando TagService
    let tagIds, tagNames;
    if (existingTagIds && existingTagNames) {
      console.log('createThought - Usando tags ya resueltos:', { existingTagIds, existingTagNames });
      tagIds = existingTagIds;
      tagNames = existingTagNames;
    } else {
      console.log('createThought - Resolviendo tags:', tags);
      const resolved = await tagService.parseAndResolveTags(tags, userId);
      tagIds = resolved.tagIds;
      tagNames = resolved.tagNames;
    }

    // Guardar el thought
    const thoughtId = uuidv4();
    const now = new Date().toISOString();
    const item = {
      thoughtId,
      userId,
      content,
      tagIds,
      tagNames,
      tagSource: tagSource || (tags ? 'Manual' : null),
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy || 'Manual',
      lastModifiedBy: createdBy || 'Manual',
      sourceMessageId: sourceMessageId || null,
      sourceConversationId: sourceConversationId || null,
      sourceTimestamp: sourceTimestamp || null,
      sourceInputType: sourceInputType || null,
      sourceIntent: sourceIntent || null
    };
    
    await docClient.put({ TableName: THOUGHTS_TBL, Item: item }).promise();

    return { 
      statusCode: 201, 
      body: JSON.stringify(item) 
    };

  } catch (err) {
    console.error('createThought error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Error al crear el thought.' }) 
    };
  }
};
