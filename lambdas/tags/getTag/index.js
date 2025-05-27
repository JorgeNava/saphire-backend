/**
 * Lambda — getTag /tags
 * Implementa la operación getTag para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getTag
  return { statusCode: 200, body: JSON.stringify({ message: "tags/getTag OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/tags?userId=usuario-123
