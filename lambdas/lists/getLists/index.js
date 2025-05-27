/**
 * Lambda — getLists /lists
 * Implementa la operación getLists para lists.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getLists para lists
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "lists/getLists OK" })
  };
};
