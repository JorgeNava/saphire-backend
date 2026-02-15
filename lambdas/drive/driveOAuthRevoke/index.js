/**
 * Lambda — driveOAuthRevoke
 * DELETE /drive/oauth?userId=X
 * Desconecta Google Drive eliminando los tokens del usuario.
 */

const { DriveService } = require('/opt/nodejs/driveService');

const driveService = new DriveService();

exports.handler = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'userId es requerido' }),
      };
    }

    // Intentar revocar el token en Google antes de eliminar
    try {
      const authClient = await driveService.getAuthClient(userId);
      if (authClient) {
        await authClient.revokeCredentials();
        console.log('🔓 Token revocado en Google para userId:', userId);
      }
    } catch (revokeErr) {
      console.warn('No se pudo revocar token en Google (continuando):', revokeErr.message);
    }

    // Eliminar tokens de DynamoDB
    await driveService.deleteTokens(userId);

    console.log('✅ Google Drive desconectado para userId:', userId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Google Drive desconectado exitosamente' }),
    };
  } catch (err) {
    console.error('driveOAuthRevoke error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al desconectar Drive' }),
    };
  }
};
