/**
 * Lambda — getTags /tags
 * Implementa la operación getTags para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getTags
  return { statusCode: 200, body: JSON.stringify({ message: "tags/getTags OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/tags?userId=usuario-123
