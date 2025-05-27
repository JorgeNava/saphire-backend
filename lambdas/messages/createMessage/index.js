/**
 * Lambda — createMessage /messages
 * Implementa la operación createMessage para messages.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de createMessage para messages
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "messages/createMessage OK" })
  };
};
