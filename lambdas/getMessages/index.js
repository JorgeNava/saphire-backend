const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');

const dynamo = new DynamoDBClient();

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { userId, classification, inputType, fromDate, toDate, usedAI } = params;

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

  let filterExpressions = [];

  if (classification) {
    filterExpressions.push('classification = :cls');
    queryParams.ExpressionAttributeValues[':cls'] = { S: classification };
  }

  if (inputType) {
    filterExpressions.push('inputType = :type');
    queryParams.ExpressionAttributeValues[':type'] = { S: inputType };
  }

  if (fromDate) {
    filterExpressions.push('timestamp >= :from');
    queryParams.ExpressionAttributeValues[':from'] = { S: fromDate };
  }

  if (toDate) {
    filterExpressions.push('timestamp <= :to');
    queryParams.ExpressionAttributeValues[':to'] = { S: toDate };
  }

  if (filterExpressions.length > 0) {
    queryParams.FilterExpression = filterExpressions.join(' AND ');
  }

  if (usedAI !== undefined) {
    filterExpressions.push('usedAI = :used');
    queryParams.ExpressionAttributeValues[':used'] = { BOOL: usedAI === 'true' };
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
