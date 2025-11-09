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

exports.handler = async (event) => {
  try {
    // Parse payload (API Gateway vs SDK invoke)
    let payload;
    if (typeof event.body === 'string') {
      payload = JSON.parse(event.body);
    } else {
      payload = event;
    }
    const { userId, content, tags, createdBy } = payload;
    if (!userId || !content) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'userId y content son requeridos.' }) 
      };
    }

    // Resolver tags usando TagService
    const { tagIds, tagNames } = await tagService.parseAndResolveTags(tags, userId);

    // Guardar el thought
    const thoughtId = uuidv4();
    const now = new Date().toISOString();
    const item = {
      thoughtId,
      userId,
      content,
      tagIds,
      tagNames,
      tagSource: tags ? 'Manual' : null,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy || 'Manual',
      lastModifiedBy: createdBy || 'Manual'
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
