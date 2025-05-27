/**
 * Lambda — createNote /notes
 * Implementa la operación createNote para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de createNote para notes
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "notes/createNote OK" })
  };
};
