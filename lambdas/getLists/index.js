// getLists.js
const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient();

exports.handler = async (event) => {
  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'userId es requerido' }) };
  }
  const params = {
    TableName: process.env.LISTS_TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': { S: userId } },
  };
  const result = await client.send(new QueryCommand(params));
  const lists = result.Items.map(i => ({
    listId:     i.listId.S,
    name:       i.name.S,
    tags:       i.tags?.SS || [],
    items:      i.items?.L.map(x => x.S) || [],
    createdAt:  i.createdAt.S
  }));
  return { statusCode: 200, body: JSON.stringify({ lists }) };
};
