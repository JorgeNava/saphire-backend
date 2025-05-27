/**
 * Lambda — getMessage /messages
 * Implementa la operación getMessage para messages.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getMessage para messages
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "messages/getMessage OK" })
  };
};
