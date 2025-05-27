/**
 * Lambda — getList /lists
 * Implementa la operación getList para lists.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getList para lists
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "lists/getList OK" })
  };
};
