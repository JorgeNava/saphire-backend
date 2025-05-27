/**
 * Lambda — getMessage /messages
 * Implementa la operación getMessage para messages.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getMessage
  return { statusCode: 200, body: JSON.stringify({ message: "messages/getMessage OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/messages?userId=usuario-123
