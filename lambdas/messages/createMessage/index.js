/**
 * Lambda — createMessage /messages
 * Implementa la operación createMessage para messages.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para createMessage
  return { statusCode: 200, body: JSON.stringify({ message: "messages/createMessage OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/messages
