/**
 * Lambda — getTag /tags
 * Implementa la operación getTag para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getTag para tags
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "tags/getTag OK" })
  };
};
