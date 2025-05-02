/**
 * Lambda — GET /messages
 * Lista mensajes de un usuario con filtros opcionales:
 *  - dateFrom/dateTo para timestamp (creación)
 *  - lastUpdatedFrom/lastUpdatedTo para lastUpdated (actualización)
 *  - classification, inputType, usedAI
 * Runtime: AWS Node.js 18.x
 */

const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');

const REGION       = process.env.AWS_REGION || 'us-east-1';
const DYNAMO_TABLE = process.env.DYNAMO_TABLE;

if (!DYNAMO_TABLE) {
  throw new Error('Environment variable DYNAMO_TABLE must be defined.');
}

const dynamo = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const {
      userId,
      classification,
      inputType,
      dateFrom,
      dateTo,
      lastUpdatedFrom,
      lastUpdatedTo,
      usedAI
    } = params;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId' }),
      };
    }

    // Base query sobre la PK
    const queryParams = {
      TableName: process.env.DYNAMO_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': { S: userId }
      }
    };

    // Si se piden rangos de timestamp (creación)
    if (dateFrom && dateTo) {
      queryParams.KeyConditionExpression = 
        'userId = :uid AND #ts BETWEEN :from AND :to';
      queryParams.ExpressionAttributeValues[':from'] = { S: dateFrom };
      queryParams.ExpressionAttributeValues[':to']   = { S: dateTo };
      queryParams.ExpressionAttributeNames = { '#ts': 'timestamp' };
    }

    // Filtros adicionales
    const filterExpressions = [];
    queryParams.ExpressionAttributeNames = queryParams.ExpressionAttributeNames || {};

    // Rangos de lastUpdated (actualización)
    if (lastUpdatedFrom && lastUpdatedTo) {
      filterExpressions.push('#lu BETWEEN :luFrom AND :luTo');
      queryParams.ExpressionAttributeValues[':luFrom'] = { S: lastUpdatedFrom };
      queryParams.ExpressionAttributeValues[':luTo']   = { S: lastUpdatedTo };
      queryParams.ExpressionAttributeNames['#lu'] = 'lastUpdated';
    }

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

    // Ejecución de la consulta
    const result = await dynamo.send(new QueryCommand(queryParams));

    // Mapear resultados
    const messages = result.Items.map(item => ({
      userId:          item.userId.S,
      timestamp:       item.timestamp.S,
      messageId:       item.messageId.S,
      inputType:       item.inputType.S,
      originalContent: item.originalContent.S,
      classification:  item.classification?.S,
      transcription:   item.transcription?.S,
      usedAI:          item.usedAI?.BOOL,
      lastUpdated:     item.lastUpdated?.S
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
