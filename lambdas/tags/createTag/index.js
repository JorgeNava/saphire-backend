/**
 * Lambda — createTag /tags
 * Implementa la operación createTag para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de createTag para tags
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "tags/createTag OK" })
  };
};
