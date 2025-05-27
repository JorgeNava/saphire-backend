/**
 * Lambda — deleteTag /tags
 * Implementa la operación deleteTag para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de deleteTag para tags
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "tags/deleteTag OK" })
  };
};
