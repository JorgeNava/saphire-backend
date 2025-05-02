const { DynamoDBClient, DeleteItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const dynamo = new DynamoDBClient();
const s3 = new S3Client();

exports.handler = async (event) => {
  const messageId = event.pathParameters.messageId;
  const userId = event.queryStringParameters.userId;

  const result = await dynamo.send(new QueryCommand({
    TableName: process.env.DYNAMO_TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": { S: userId } }
  }));

  const item = result.Items.find(i => i.messageId.S === messageId);
  if (!item) return { statusCode: 404, body: "Not found" };

  await dynamo.send(new DeleteItemCommand({
    TableName: process.env.DYNAMO_TABLE,
    Key: {
      userId: { S: userId },
      timestamp: { S: item.timestamp.S }
    }
  }));

  if (item.inputType.S === "audio") {
    const s3Key = item.originalContent.S.split('/').pop();
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.AUDIO_BUCKET, Key: s3Key }));
  }

  return { statusCode: 200, body: "Deleted" };
};
