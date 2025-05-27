/**
 * Lambda — getThoughts /thoughts
 * Implementa la operación getThoughts para thoughts.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getThoughts
  return { statusCode: 200, body: JSON.stringify({ message: "thoughts/getThoughts OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/thoughts?userId=usuario-123
