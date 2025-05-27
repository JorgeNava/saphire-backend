/**
 * Lambda — getUser /users
 * Implementa la operación getUser para users.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getUser para users
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "users/getUser OK" })
  };
};
