/**
 * Lambda — createThought /thoughts
 * Implementa la operación createThought para thoughts.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para createThought
  return { statusCode: 200, body: JSON.stringify({ message: "thoughts/createThought OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/thoughts
