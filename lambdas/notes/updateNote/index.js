/**
 * Lambda — updateNote /notes
 * Implementa la operación updateNote para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para updateNote
  return { statusCode: 200, body: JSON.stringify({ message: "notes/updateNote OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/notes
