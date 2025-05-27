/**
 * Lambda — deleteNote /notes
 * Implementa la operación deleteNote para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de deleteNote para notes
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "notes/deleteNote OK" })
  };
};
