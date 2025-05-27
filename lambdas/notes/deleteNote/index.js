/**
 * Lambda — deleteNote /notes
 * Implementa la operación deleteNote para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para deleteNote
  return { statusCode: 200, body: JSON.stringify({ message: "notes/deleteNote OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/notes/<id>?userId=usuario-123
