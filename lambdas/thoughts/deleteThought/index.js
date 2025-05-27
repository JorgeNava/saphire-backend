/**
 * Lambda — deleteThought /thoughts
 * Implementa la operación deleteThought para thoughts.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para deleteThought
  return { statusCode: 200, body: JSON.stringify({ message: "thoughts/deleteThought OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/thoughts/<id>?userId=usuario-123
