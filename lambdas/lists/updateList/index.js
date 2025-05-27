/**
 * Lambda — updateList /lists
 * Implementa la operación updateList para lists.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para updateList
  return { statusCode: 200, body: JSON.stringify({ message: "lists/updateList OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/lists
