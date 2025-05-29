/**
 * Lambda — updateThought
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/thoughts/{thoughtId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "content":"Contenido actualizado",
 *     "tagIds":["tag1","tag3"]   // obligatorio
 *   }'
 */

const AWS = require('aws-sdk');
const docClient    = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;

exports.handler = async (event) => {
  try {
    const { thoughtId } = event.pathParameters;
    const { content, tagIds } = JSON.parse(event.body);

    if (!thoughtId || !content || !Array.isArray(tagIds)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'thoughtId, content y tagIds son requeridos.' })
      };
    }

    const timestamp = new Date().toISOString();
    const params = {
      TableName: THOUGHTS_TBL,
      Key: { thoughtId },
      UpdateExpression: [
        'SET content = :c',
        ', tagIds = :t',
        ', tagSource = :s',
        ', updatedAt = :u',
        ', lastModifiedBy = :m'
      ].join(''),
      ExpressionAttributeValues: {
        ':c': content,
        ':t': tagIds,
        ':s': 'Manual',
        ':u': timestamp,
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
    console.error('updateThought error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al actualizar el thought.' })
    };
  }
};
