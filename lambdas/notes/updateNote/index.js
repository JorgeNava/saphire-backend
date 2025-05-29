/**
 * Lambda — updateNote
 * CURL example:
 * curl -X PUT https://{api-id}.execute-api.{region}.amazonaws.com/notes/{noteId} \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "title":"Título actualizado",
 *     "content":"Contenido modificado",
 *     "attachmentKeys":["nuevo.pdf"],  // opcional
 *     "tagIds":["tag1","tag3"]         // opcional
 *   }'
 */

const AWS = require('aws-sdk');
const docClient  = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { noteId } = event.pathParameters;
    const { title, content, attachmentKeys = [], tagIds = [] } = JSON.parse(event.body);

    if (!noteId || !title || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'noteId, title y content son requeridos.' })
      };
    }

    const updatedAt = new Date().toISOString();
    const params = {
      TableName: TABLE_NAME,
      Key: { noteId },
      UpdateExpression: [
        'SET title = :t',
        ', content = :c',
        ', attachmentKeys = :a',
        ', tagIds = :g',
        ', updatedAt = :u',
        ', lastModifiedBy = :m'
      ].join(''),
      ExpressionAttributeValues: {
        ':t': title,
        ':c': content,
        ':a': attachmentKeys,
        ':g': tagIds,
        ':u': updatedAt,
        ':m': 'Manual'
      },
      ReturnValues: 'ALL_NEW'
    };

    const res = await docClient.update(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(res.Attributes)
    };
  } catch (err) {
    console.error('updateNote error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al actualizar la nota.' })
    };
  }
};
