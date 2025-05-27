/**
 * Lambda — getThought /thoughts
 * Implementa la operación getThought para thoughts.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getThought
  return { statusCode: 200, body: JSON.stringify({ message: "thoughts/getThought OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/thoughts?userId=usuario-123
