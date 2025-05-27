/**
 * Lambda — getMessages /messages
 * Implementa la operación getMessages para messages.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getMessages
  return { statusCode: 200, body: JSON.stringify({ message: "messages/getMessages OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/messages?userId=usuario-123
