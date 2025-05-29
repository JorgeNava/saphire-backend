/**
 * Lambda — getLists
 * CURL example:
 * curl -X GET "https://{api-id}.execute-api.{region}.amazonaws.com/lists?userId=user123"
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_LISTS;
const INDEX_NAME = 'GSI-userLists';

exports.handler = async (event) => {
  try {
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "El query parameter userId es requerido." })
      };
    }

    const result = await docClient.query({
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: {
        ':u': userId
      }
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(result.Items || [])
    };
  } catch (error) {
    console.error("getLists error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al listar las listas." })
    };
  }
};
