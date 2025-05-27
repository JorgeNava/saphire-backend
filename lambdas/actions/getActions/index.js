/**
 * Lambda — getActions /actions
 * Implementa la operación getActions para actions.
 * Runtime: Node.js 18.x
 */
exports.handler = async (event) => {
  // Aquí va la lógica de DynamoDB para getActions
  return { statusCode: 200, body: JSON.stringify({ message: "actions/getActions OK" }) };
};

// Curl de prueba:
// curl -X POST https://<API_URL>/actions?userId=usuario-123
