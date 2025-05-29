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

exports.handler = async (event) => {
  try {
    const { userId, name, color } = JSON.parse(event.body);
    if (!userId || !name || !color) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId, name y color son requeridos.' })
      };
    }

    const tagId     = uuidv4();
    const timestamp = new Date().toISOString();
    const item = {
      tagId,
      userId,
      name,
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
      body: JSON.stringify(item)
    };
  } catch (err) {
    console.error('createTag error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear la etiqueta.' })
    };
  }
};
