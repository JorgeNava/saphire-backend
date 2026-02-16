/**
 * Lambda — driveOAuthCallback
 * GET /drive/oauth/callback?code=X&state=userId
 * Recibe el código de Google, intercambia por tokens, guarda en DynamoDB,
 * y redirige a la app mobile via deep link.
 */

const { DriveService } = require('/opt/nodejs/driveService');
const { google } = require('googleapis');

const driveService = new DriveService();
const DEEP_LINK_SCHEME = process.env.APP_DEEP_LINK_SCHEME || 'saphiremobile';

exports.handler = async (event) => {
  try {
    const code = event.queryStringParameters?.code;
    const userId = event.queryStringParameters?.state;

    if (!code || !userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: '<h1>Error</h1><p>Parámetros faltantes (code o state/userId).</p>',
      };
    }

    // Construir la redirect URI (debe coincidir con la usada en driveOAuthStart)
    const host = event.headers?.host || '';
    const stage = event.requestContext?.stage || '';
    const basePath = stage && stage !== '$default' ? `/${stage}` : '';
    const redirectUri = `https://${host}${basePath}/drive/oauth/callback`;

    const oauth2Client = driveService.createOAuth2Client(redirectUri);
    const tokens = await driveService.exchangeCode(oauth2Client, code);

    // Obtener email del usuario de Google
    let email = '';
    try {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      email = userInfo.data.email || '';
    } catch (emailErr) {
      console.warn('No se pudo obtener email de Google:', emailErr.message);
    }

    // Guardar tokens en DynamoDB
    await driveService.saveTokens(userId, tokens, email);

    console.log('✅ Google Drive conectado para userId:', userId, 'email:', email);

    // Redirigir a la app mobile via deep link
    const deepLink = `${DEEP_LINK_SCHEME}://drive/connected?status=success&email=${encodeURIComponent(email)}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Zafira - Drive Conectado</title>
          <style>
            body { font-family: -apple-system, sans-serif; text-align: center; padding: 60px 20px; background: #0A0E27; color: #fff; }
            h1 { color: #4CAF50; font-size: 24px; }
            p { color: #ccc; font-size: 16px; margin: 16px 0; }
            .btn { display: inline-block; padding: 14px 28px; background: #6C63FF; color: #fff; text-decoration: none; border-radius: 8px; font-size: 16px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>✅ Google Drive conectado</h1>
          <p>Tu cuenta <strong>${email}</strong> ha sido vinculada exitosamente a Zafira.</p>
          <p>Ya puedes cerrar esta ventana y regresar a la app.</p>
          <a href="${deepLink}" class="btn">Abrir Zafira</a>
          <script>
            // Intentar abrir el deep link automáticamente
            setTimeout(function() { window.location.href = "${deepLink}"; }, 1500);
          </script>
        </body>
        </html>
      `,
    };
  } catch (err) {
    console.error('driveOAuthCallback error:', err);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Zafira - Error</title>
          <style>
            body { font-family: -apple-system, sans-serif; text-align: center; padding: 60px 20px; background: #0A0E27; color: #fff; }
            h1 { color: #f44336; font-size: 24px; }
            p { color: #ccc; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>❌ Error al conectar</h1>
          <p>No se pudo vincular tu cuenta de Google Drive.</p>
          <p>${err.message}</p>
          <p>Cierra esta ventana e intenta de nuevo desde la app.</p>
        </body>
        </html>
      `,
    };
  }
};
