/**
 * Lambda — createUser /users
 * Implementa la operación createUser para users.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de createUser para users
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "users/createUser OK" })
  };
};
