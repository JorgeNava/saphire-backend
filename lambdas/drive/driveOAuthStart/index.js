/**
 * Lambda — driveOAuthStart
 * GET /drive/oauth/start?userId=X
 * Genera la URL de consentimiento de Google y redirige al usuario.
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

    // Construir la redirect URI dinámicamente desde el evento
    const host = event.headers?.host || '';
    const stage = event.requestContext?.stage || '';
    const basePath = stage && stage !== '$default' ? `/${stage}` : '';
    const redirectUri = `https://${host}${basePath}/drive/oauth/callback`;

    const oauth2Client = driveService.createOAuth2Client(redirectUri);
    const authUrl = driveService.getAuthUrl(oauth2Client, userId);

    console.log('🔗 Redirigiendo a Google OAuth para userId:', userId);

    return {
      statusCode: 302,
      headers: {
        Location: authUrl,
      },
      body: '',
    };
  } catch (err) {
    console.error('driveOAuthStart error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error al iniciar OAuth', details: err.message }),
    };
  }
};
