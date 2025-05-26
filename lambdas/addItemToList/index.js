const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient();

exports.handler = async (event) => {
  const { listId, userId, newItem } = JSON.parse(event.body);
  if (!userId || !listId || !newItem) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos' }) };
  }
  const params = {
    TableName: process.env.LISTS_TABLE,
    Key: {
      userId: { S: userId },
      listId: { S: listId }
    },
    UpdateExpression: 'SET items = list_append(if_not_exists(items, :empty), :it)',
    ExpressionAttributeValues: {
      ':it':    { L: [{ S: newItem }] },
      ':empty': { L: [] }
    },
    ReturnValues: 'UPDATED_NEW'
  };
  const res = await client.send(new UpdateItemCommand(params));
  const updated = res.Attributes.items.L.map(x => x.S);
  return { statusCode: 200, body: JSON.stringify({ items: updated }) };
};
