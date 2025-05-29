/**
 * Lambda — getTags
 * CURL example:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/tags?userId=user123"
 */

const AWS = require('aws-sdk');
const docClient  = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_TAGS;
const INDEX_NAME = 'GSI-userTags';

exports.handler = async (event) => {
  try {
    const { userId } = event.queryStringParameters || {};
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El query param userId es requerido.' })
      };
    }

    const res = await docClient.query({
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      ScanIndexForward: true
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(res.Items || [])
    };
  } catch (err) {
    console.error('getTags error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al listar etiquetas.' })
    };
  }
};
