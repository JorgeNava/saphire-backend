/**
 * Lambda — createList /lists
 * Implementa la operación createList para lists.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de createList para lists
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "lists/createList OK" })
  };
};
