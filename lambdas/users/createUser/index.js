/**
 * Lambda — createUser /users
 * Implementa la operación createUser para users.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para createUser
  return { statusCode: 200, body: JSON.stringify({ message: "users/createUser OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/users
