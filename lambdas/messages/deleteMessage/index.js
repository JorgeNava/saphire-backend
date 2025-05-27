/**
 * Lambda — deleteMessage /messages
 * Implementa la operación deleteMessage para messages.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de deleteMessage para messages
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "messages/deleteMessage OK" })
  };
};
