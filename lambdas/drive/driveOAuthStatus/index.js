/**
 * Lambda — driveOAuthStatus
 * GET /drive/oauth/status?userId=X
 * Verifica si el usuario tiene Google Drive conectado.
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

    const stored = await driveService.getTokens(userId);

    if (!stored || !stored.refreshToken) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connected: false,
          email: null,
          connectedAt: null,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connected: true,
        email: stored.email || null,
        connectedAt: stored.connectedAt || null,
      }),
    };
  } catch (err) {
    console.error('driveOAuthStatus error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al verificar estado de Drive' }),
    };
  }
};
