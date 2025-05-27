/**
 * Lambda — getNote /notes
 * Implementa la operación getNote para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getNote
  return { statusCode: 200, body: JSON.stringify({ message: "notes/getNote OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/notes?userId=usuario-123
