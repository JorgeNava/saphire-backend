/**
 * Lambda — getNote /notes
 * Implementa la operación getNote para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getNote para notes
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "notes/getNote OK" })
  };
};
