const { DynamoDBClient, UpdateItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient();

exports.handler = async (event) => {
  const messageId = event.pathParameters.messageId;
  const { userId, classification, summary, transcription } = JSON.parse(event.body);

  const result = await client.send(new QueryCommand({
    TableName: process.env.DYNAMO_TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": { S: userId } }
  }));

  const item = result.Items.find(i => i.messageId.S === messageId);
  if (!item) return { statusCode: 404, body: "Not found" };

  const timestamp = item.timestamp.S;

  await client.send(new UpdateItemCommand({
    TableName: process.env.DYNAMO_TABLE,
    Key: {
      userId: { S: userId },
      timestamp: { S: timestamp }
    },
    UpdateExpression: "SET classification = :c, summary = :s, transcription = :t",
    ExpressionAttributeValues: {
      ":c": { S: classification },
      ":s": { S: summary || "" },
      ":t": { S: transcription || "" }
    }
  }));

  return { statusCode: 200, body: "Updated" };
};
