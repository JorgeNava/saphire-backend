/**
 * Lambda — createList /lists
 * Implementa la operación createList para lists.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para createList
  return { statusCode: 200, body: JSON.stringify({ message: "lists/createList OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/lists
