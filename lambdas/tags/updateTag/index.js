/**
 * Lambda — updateTag /tags
 * Implementa la operación updateTag para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para updateTag
  return { statusCode: 200, body: JSON.stringify({ message: "tags/updateTag OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/tags
