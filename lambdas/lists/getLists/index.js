/**
 * Lambda — getLists /lists
 * Implementa la operación getLists para lists.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getLists
  return { statusCode: 200, body: JSON.stringify({ message: "lists/getLists OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/lists?userId=usuario-123
