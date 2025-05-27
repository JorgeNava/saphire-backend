/**
 * Lambda — createTag /tags
 * Implementa la operación createTag para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para createTag
  return { statusCode: 200, body: JSON.stringify({ message: "tags/createTag OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/tags
