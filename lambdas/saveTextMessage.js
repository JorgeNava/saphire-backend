const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient();

exports.handler = async (event) => {
  const { userId, text, classification } = JSON.parse(event.body);
  const messageId = uuidv4();
  const timestamp = new Date().toISOString();

  const params = {
    TableName: process.env.DYNAMO_TABLE,
    Item: {
      userId: { S: userId },
      timestamp: { S: timestamp },
      messageId: { S: messageId },
      inputType: { S: "text" },
      originalContent: { S: text },
      classification: { S: classification }
    }
  };

  await client.send(new PutItemCommand(params));

  return { statusCode: 200, body: JSON.stringify({ messageId }) };
};
