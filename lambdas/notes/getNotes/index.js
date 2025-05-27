/**
 * Lambda — getNotes /notes
 * Implementa la operación getNotes para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Lógica de getNotes para notes
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "notes/getNotes OK" })
  };
};
