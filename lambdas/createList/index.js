const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient();

exports.handler = async (event) => {
  const { userId, name, tags = [], items = [] } = JSON.parse(event.body);
  if (!userId || !name.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'userId y name son requeridos' }) };
  }
  const listId = uuidv4();
  const now = new Date().toISOString();
  const params = {
    TableName: process.env.LISTS_TABLE,
    Item: {
      userId:    { S: userId },
      listId:    { S: listId },
      name:      { S: name },
      tags:      { SS: tags },
      items:     { L: items.map(i => ({ S: i })) },
      createdAt: { S: now }
    }
  };
  await client.send(new PutItemCommand(params));
  return {
    statusCode: 201,
    body: JSON.stringify({ listId, name, tags, items, createdAt: now })
  };
};
