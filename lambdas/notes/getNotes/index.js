/**
 * Lambda — getNotes /notes
 * Implementa la operación getNotes para notes.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getNotes
  return { statusCode: 200, body: JSON.stringify({ message: "notes/getNotes OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/notes?userId=usuario-123
