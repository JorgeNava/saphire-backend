/**
 * Lambda — deleteTag /tags
 * Implementa la operación deleteTag para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para deleteTag
  return { statusCode: 200, body: JSON.stringify({ message: "tags/deleteTag OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/tags/<id>?userId=usuario-123
