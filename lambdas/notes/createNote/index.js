/**
 * Lambda — createNote /notes
 * Implementa la operación createNote para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para createNote
  return { statusCode: 200, body: JSON.stringify({ message: "notes/createNote OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/notes
