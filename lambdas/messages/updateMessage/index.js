/**
 * Lambda — updateMessage
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/messages/{messageId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "sender":"user123",
 *     "content":"Texto modificado",
 *     // opcional: "tagIds":["tag1","tag3"]
 *   }'
 */

const AWS = require('aws-sdk');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const tagService = new TagService();
const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;

exports.handler = async (event) => {
  try {
    const { messageId } = event.pathParameters;
    const { sender, content, tags } = JSON.parse(event.body);
    if (!messageId || !sender || !content) {
      return { 
        statusCode: 400,
        body: JSON.stringify({ error: 'messageId, sender y content son requeridos.' }) 
      };
    }

    // 1) Buscar el mensaje
    const scanRes = await docClient.scan({
      TableName: MSG_TABLE,
      FilterExpression: 'messageId = :m',
      ExpressionAttributeValues: { ':m': messageId }
    }).promise();

    if (!scanRes.Items || scanRes.Items.length === 0) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: 'Mensaje no encontrado.' }) 
      };
    }
    const { conversationId, timestamp } = scanRes.Items[0];

    // 2) Resolver tags usando TagService
    const { tagIds, tagNames } = await tagService.parseAndResolveTags(tags, sender);

    // 3) Actualizar mensaje
    const updatedAt = new Date().toISOString();
    const params = {
      TableName: MSG_TABLE,
      Key: { conversationId, timestamp },
      UpdateExpression: 'SET content = :c, tagIds = :t, tagNames = :tn, tagSource = :ts, updatedAt = :u, lastModifiedBy = :l',
      ExpressionAttributeValues: {
        ':c': content,
        ':t': tagIds,
        ':tn': tagNames,
        ':ts': tags ? 'Manual' : null,
        ':u': updatedAt,
        ':l': sender
      },
      ReturnValues: 'ALL_NEW'
    };

    const res = await docClient.update(params).promise();
    return { 
      statusCode: 200, 
      body: JSON.stringify(res.Attributes) 
    };
  } catch (err) {
    console.error('updateMessage error:', err);
    return { 
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al actualizar mensaje.' }) 
    };
  }
};
