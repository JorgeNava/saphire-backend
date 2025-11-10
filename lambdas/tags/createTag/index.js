/**
 * Lambda — createTag
 * CURL example:
 * curl -X POST https://{api-id}.execute-api.{region}.amazonaws.com/tags \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId":"user123",
 *     "name":"Importante",
 *     "color":"#FF0000"
 *   }'
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient  = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_TAGS;
const INDEX_NAME = 'GSI-userTags';

/**
 * Verifica si ya existe una etiqueta con el mismo nombre (case-insensitive)
 */
async function checkDuplicateTagName(userId, name) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: INDEX_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  };

  const result = await docClient.query(params).promise();
  const tags = result.Items || [];
  
  // Comparación case-insensitive
  const nameLower = name.toLowerCase().trim();
  return tags.some(tag => tag.name.toLowerCase().trim() === nameLower);
}

exports.handler = async (event) => {
  try {
    const { userId, name, color } = JSON.parse(event.body);
    if (!userId || !name || !color) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'userId, name y color son requeridos.' })
      };
    }

    // Validar nombre único
    const isDuplicate = await checkDuplicateTagName(userId, name);
    if (isDuplicate) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'DUPLICATE_TAG_NAME',
          message: 'Ya existe una etiqueta con este nombre'
        })
      };
    }

    const tagId     = uuidv4();
    const timestamp = new Date().toISOString();
    const item = {
      tagId,
      userId,
      name: name.trim(),
      color,
      createdAt:      timestamp,
      updatedAt:      timestamp,
      createdBy:      'Manual',
      lastModifiedBy: 'Manual'
    };

    await docClient.put({
      TableName: TABLE_NAME,
      Item: item
    }).promise();

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    };
  } catch (err) {
    console.error('createTag error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al crear la etiqueta.' })
    };
  }
};
