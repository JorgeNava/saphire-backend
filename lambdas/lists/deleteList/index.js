/**
 * Lambda — deleteList /lists
 * Implementa la operación deleteList para lists.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para deleteList
  return { statusCode: 200, body: JSON.stringify({ message: "lists/deleteList OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/lists/<id>?userId=usuario-123
