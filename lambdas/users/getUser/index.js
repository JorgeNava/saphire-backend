/**
 * Lambda — getUser /users
 * Implementa la operación getUser para users.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getUser
  return { statusCode: 200, body: JSON.stringify({ message: "users/getUser OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/users?userId=usuario-123
