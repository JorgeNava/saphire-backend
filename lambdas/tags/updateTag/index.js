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

exports.handler = async (event) => {
  try {
    const { tagId } = event.pathParameters;
    const { name, color } = JSON.parse(event.body);

    if (!tagId || !name || !color) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'tagId, name y color son requeridos.' })
      };
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
        ':name': name,
        ':color': color,
        ':u': updatedAt,
        ':m': 'Manual'
      },
      ReturnValues: 'ALL_NEW'
    };

    const res = await docClient.update(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(res.Attributes)
    };
  } catch (err) {
    console.error('updateTag error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al actualizar la etiqueta.' })
    };
  }
};
