/**
 * Lambda — updateTag
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/tags/{tagId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "name":"Nuevo nombre",
 *     "color":"#00FF00"
 *   }'
 */

const AWS = require('aws-sdk');
const docClient  = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_TAGS;
const INDEX_NAME = 'GSI-userTags';

/**
 * Verifica si ya existe una etiqueta con el mismo nombre (case-insensitive)
 * excluyendo el tagId actual
 */
async function checkDuplicateTagName(userId, name, excludeTagId) {
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
  
  // Comparación case-insensitive, excluyendo el tag actual
  const nameLower = name.toLowerCase().trim();
  return tags.some(tag => 
    tag.tagId !== excludeTagId && 
    tag.name.toLowerCase().trim() === nameLower
  );
}

exports.handler = async (event) => {
  try {
    const { tagId } = event.pathParameters;
    const { name, color, userId } = JSON.parse(event.body);

    if (!tagId || !name || !color) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'tagId, name y color son requeridos.' })
      };
    }

    // Si se proporciona userId, validar nombre único
    if (userId) {
      const isDuplicate = await checkDuplicateTagName(userId, name, tagId);
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
    }

    const updatedAt = new Date().toISOString();
    const params = {
      TableName: TABLE_NAME,
      Key: { tagId },
      UpdateExpression: [
        'SET #n = :name',
        ', color = :color',
        ', updatedAt = :u',
        ', lastModifiedBy = :m'
      ].join(''),
      ExpressionAttributeNames: { '#n': 'name' },
      ExpressionAttributeValues: {
        ':name': name.trim(),
        ':color': color,
        ':u': updatedAt,
        ':m': 'Manual'
      },
      ReturnValues: 'ALL_NEW'
    };

    const res = await docClient.update(params).promise();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(res.Attributes)
    };
  } catch (err) {
    console.error('updateTag error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al actualizar la etiqueta.' })
    };
  }
};
