/**
 * Lambda — updateUser /users
 * Implementa la operación updateUser para users.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para updateUser
  return { statusCode: 200, body: JSON.stringify({ message: "users/updateUser OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/users
