const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');

const dynamo = new DynamoDBClient();

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { userId, classification, inputType, dateFrom, dateTo, usedAI } = params;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing userId' }),
    };
  }

  const queryParams = {
    TableName: process.env.DYNAMO_TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: {
      ':uid': { S: userId }
    }
  };

  if (dateFrom && dateTo) {
    queryParams.KeyConditionExpression = 'userId = :uid AND #ts BETWEEN :from AND :to';
    queryParams.ExpressionAttributeValues[':from'] = { S: dateFrom };
    queryParams.ExpressionAttributeValues[':to'] = { S: dateTo };
    queryParams.ExpressionAttributeNames = { '#ts': 'timestamp' };
  }

  let filterExpressions = [];

  if (classification) {
    filterExpressions.push('classification = :cls');
    queryParams.ExpressionAttributeValues[':cls'] = { S: classification };
  }

  if (inputType) {
    filterExpressions.push('inputType = :type');
    queryParams.ExpressionAttributeValues[':type'] = { S: inputType };
  }

  if (usedAI !== undefined) {
    filterExpressions.push('usedAI = :used');
    queryParams.ExpressionAttributeValues[':used'] = { BOOL: usedAI === 'true' };
  }

  if (filterExpressions.length > 0) {
    queryParams.FilterExpression = filterExpressions.join(' AND ');
  }

  try {
    const result = await dynamo.send(new QueryCommand(queryParams));

    const messages = result.Items.map(item => ({
      userId: item.userId.S,
      timestamp: item.timestamp.S,
      messageId: item.messageId.S,
      inputType: item.inputType.S,
      originalContent: item.originalContent.S,
      classification: item.classification?.S,
      transcription: item.transcription?.S,
      usedAI: item.usedAI?.BOOL,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ messages }),
    };
  } catch (error) {
    console.error("DynamoDB error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error fetching messages' }),
    };
  }
};
