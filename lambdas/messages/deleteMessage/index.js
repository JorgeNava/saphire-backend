/**
 * Lambda — deleteMessage /messages
 * Implementa la operación deleteMessage para messages.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para deleteMessage
  return { statusCode: 200, body: JSON.stringify({ message: "messages/deleteMessage OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/messages/<id>?userId=usuario-123
