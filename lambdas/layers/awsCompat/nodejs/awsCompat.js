/**
 * awsCompat — adaptador v2→v3.
 * Expone la MISMA API que aws-sdk v2 (DocumentClient/Lambda con `.op(p).promise()`)
 * pero por dentro usa @aws-sdk v3, que ya viene en el runtime nodejs18 (sin empaquetar).
 * Permite migrar 44 lambdas + 2 layers cambiando solo la línea del cliente, sin tocar
 * los call-sites. Las respuestas de lib-dynamodb son idénticas a las del DocumentClient v2.
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand, PutCommand, QueryCommand, ScanCommand,
  UpdateCommand, DeleteCommand, BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const region = process.env.AWS_REGION;

const _doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const thenable = (p) => ({ promise: () => p });

const docClient = {
  get:      (p) => thenable(_doc.send(new GetCommand(p))),
  put:      (p) => thenable(_doc.send(new PutCommand(p))),
  query:    (p) => thenable(_doc.send(new QueryCommand(p))),
  scan:     (p) => thenable(_doc.send(new ScanCommand(p))),
  update:   (p) => thenable(_doc.send(new UpdateCommand(p))),
  delete:   (p) => thenable(_doc.send(new DeleteCommand(p))),
  batchGet: (p) => thenable(_doc.send(new BatchGetCommand(p))),
};

const _lambda = new LambdaClient({ region });
const lambda = {
  invoke: (p) => {
    const params = { ...p };
    // v3 exige Payload como Uint8Array; v2 aceptaba string.
    if (typeof params.Payload === 'string') {
      params.Payload = new TextEncoder().encode(params.Payload);
    }
    return thenable(
      _lambda.send(new InvokeCommand(params)).then((r) => ({
        ...r,
        // Devolver Payload como string (como v2) para no romper consumidores.
        Payload: r.Payload ? new TextDecoder().decode(r.Payload) : r.Payload,
      })),
    );
  },
};

module.exports = { docClient, lambda };
