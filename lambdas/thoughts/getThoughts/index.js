/**
 * Lambda — getThoughts
 * CURL example:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/thoughts?userId=user123"
 */

const AWS = require('aws-sdk');
const docClient    = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const INDEX_NAME   = 'GSI-userThoughts';

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
      TableName: THOUGHTS_TBL,
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
    console.error('getThoughts error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al listar thoughts.' })
    };
  }
};
