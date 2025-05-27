/**
 * Lambda — getTags /tags
 * Implementa la operación getTags para tags.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getTags para tags
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "tags/getTags OK" })
  };
};
