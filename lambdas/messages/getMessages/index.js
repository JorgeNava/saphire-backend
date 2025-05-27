/**
 * Lambda — getMessages /messages
 * Implementa la operación getMessages para messages.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getMessages para messages
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "messages/getMessages OK" })
  };
};
