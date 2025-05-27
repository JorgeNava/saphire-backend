/**
 * Lambda — getList /lists
 * Implementa la operación getList para lists.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getList
  return { statusCode: 200, body: JSON.stringify({ message: "lists/getList OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/lists?userId=usuario-123
