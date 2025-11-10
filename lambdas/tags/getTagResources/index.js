/**
 * Lambda — getTagResources
 * GET /tags/{tagId}/resources
 * 
 * Obtiene una etiqueta y todos los recursos (thoughts, lists, notes) asociados.
 * 
 * CURL example:
 * curl -X GET https://{api-id}.execute-api.{region}.amazonaws.com/tags/{tagId}/resources?userId=user123
 */

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });

const TAGS_TABLE = process.env.AWS_DYNAMODB_TABLE_TAGS;
const THOUGHTS_TABLE = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const LISTS_TABLE = process.env.AWS_DYNAMODB_TABLE_LISTS;
const NOTES_TABLE = process.env.AWS_DYNAMODB_TABLE_NOTES;

exports.handler = async (event) => {
  try {
    const { tagId } = event.pathParameters;
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'userId es requerido' })
      };
    }

    // 1. Obtener tag
    const tagResult = await docClient.get({
      TableName: TAGS_TABLE,
      Key: { tagId }
    }).promise();

    const tag = tagResult.Item;

    if (!tag) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Etiqueta no encontrada' })
      };
    }

    // Verificar ownership
    if (tag.userId !== userId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No tienes permiso para acceder a esta etiqueta' })
      };
    }

    // 2. Buscar thoughts con este tag (usando GSI-userThoughts)
    const thoughtsResult = await docClient.query({
      TableName: THOUGHTS_TABLE,
      IndexName: 'GSI-userThoughts',
      KeyConditionExpression: 'userId = :u',
      FilterExpression: 'contains(tagIds, :tagId)',
      ExpressionAttributeValues: {
        ':u': userId,
        ':tagId': tagId
      }
    }).promise();

    // 3. Buscar lists con este tag (usando GSI-userLists)
    const listsResult = await docClient.query({
      TableName: LISTS_TABLE,
      IndexName: 'GSI-userLists',
      KeyConditionExpression: 'userId = :u',
      FilterExpression: 'contains(tagIds, :tagId)',
      ExpressionAttributeValues: {
        ':u': userId,
        ':tagId': tagId
      }
    }).promise();

    // 4. Buscar notes con este tag (usando GSI-userNotes)
    const notesResult = await docClient.query({
      TableName: NOTES_TABLE,
      IndexName: 'GSI-userNotes',
      KeyConditionExpression: 'userId = :u',
      FilterExpression: 'contains(tagIds, :tagId)',
      ExpressionAttributeValues: {
        ':u': userId,
        ':tagId': tagId
      }
    }).promise();

    const thoughts = thoughtsResult.Items || [];
    const lists = listsResult.Items || [];
    const notes = notesResult.Items || [];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag,
        thoughts,
        lists,
        notes,
        counts: {
          thoughts: thoughts.length,
          lists: lists.length,
          notes: notes.length,
          total: thoughts.length + lists.length + notes.length
        }
      })
    };

  } catch (error) {
    console.error('getTagResources error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al obtener recursos de la etiqueta' })
    };
  }
};
