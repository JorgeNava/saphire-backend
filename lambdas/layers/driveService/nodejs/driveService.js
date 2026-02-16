/**
 * DriveService - Servicio compartido para integración con Google Drive
 * Usado por las Lambdas de OAuth2 y consultas de Drive
 */

const AWS = require('aws-sdk');
const { OAuth2Client } = require('google-auth-library');

// Lazy-load Drive API para que las lambdas de OAuth no fallen si hay problema con el módulo
let _driveApi = null;
function getDriveClient(auth) {
  if (!_driveApi) {
    const driveModule = require('@googleapis/drive');
    _driveApi = driveModule.drive;
  }
  return _driveApi({ version: 'v3', auth });
}

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const INTEGRATIONS_TABLE = process.env.AWS_DYNAMODB_TABLE_USER_INTEGRATIONS;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

class DriveService {
  /**
   * Crea un cliente OAuth2 de Google con las credenciales configuradas
   * @param {string} redirectUri - URI de redirección para el flujo OAuth
   * @returns {google.auth.OAuth2}
   */
  createOAuth2Client(redirectUri) {
    return new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );
  }

  /**
   * Genera la URL de autorización de Google
   * @param {google.auth.OAuth2} oauth2Client
   * @param {string} state - Estado para CSRF protection (userId)
   * @returns {string}
   */
  getAuthUrl(oauth2Client, state) {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.readonly'],
      state,
    });
  }

  /**
   * Intercambia el código de autorización por tokens
   * @param {google.auth.OAuth2} oauth2Client
   * @param {string} code
   * @returns {Promise<object>}
   */
  async exchangeCode(oauth2Client, code) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Guarda los tokens del usuario en DynamoDB
   * @param {string} userId
   * @param {object} tokens - { access_token, refresh_token, expiry_date }
   * @param {string} email - Email de la cuenta de Google (opcional)
   */
  async saveTokens(userId, tokens, email = '') {
    const item = {
      userId,
      integrationId: 'integration#google_drive',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date).toISOString(),
      email,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.put({
      TableName: INTEGRATIONS_TABLE,
      Item: item,
    }).promise();

    return item;
  }

  /**
   * Obtiene los tokens almacenados del usuario
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async getTokens(userId) {
    const result = await docClient.get({
      TableName: INTEGRATIONS_TABLE,
      Key: {
        userId,
        integrationId: 'integration#google_drive',
      },
    }).promise();

    return result.Item || null;
  }

  /**
   * Elimina los tokens del usuario (desconectar Drive)
   * @param {string} userId
   */
  async deleteTokens(userId) {
    await docClient.delete({
      TableName: INTEGRATIONS_TABLE,
      Key: {
        userId,
        integrationId: 'integration#google_drive',
      },
    }).promise();
  }

  /**
   * Obtiene un cliente OAuth2 autenticado para el usuario.
   * Refresca el token automáticamente si ha expirado.
   * @param {string} userId
   * @returns {Promise<google.auth.OAuth2|null>}
   */
  async getAuthClient(userId) {
    const stored = await this.getTokens(userId);
    if (!stored || !stored.refreshToken) return null;

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: stored.accessToken,
      refresh_token: stored.refreshToken,
      expiry_date: new Date(stored.expiresAt).getTime(),
    });

    // Si el token está expirado, refrescar
    const now = Date.now();
    const expiresAt = new Date(stored.expiresAt).getTime();
    if (now >= expiresAt - 60000) { // 1 minuto de margen
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        // Guardar los nuevos tokens
        await this.saveTokens(userId, {
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || stored.refreshToken,
          expiry_date: credentials.expiry_date,
        }, stored.email);
      } catch (err) {
        console.error('Error refreshing token:', err);
        return null;
      }
    }

    return oauth2Client;
  }

  /**
   * Lista archivos en una carpeta de Google Drive
   * @param {google.auth.OAuth2} authClient
   * @param {string} folderId
   * @returns {Promise<Array<{id, name, mimeType, webViewLink, modifiedTime}>>}
   */
  async listFiles(authClient, folderId) {
    const driveClient = getDriveClient(authClient);
    const response = await driveClient.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime, createdTime)',
      orderBy: 'name',
      pageSize: 100,
    });

    return response.data.files || [];
  }

  /**
   * Obtiene el contenido de texto de un Google Doc
   * @param {google.auth.OAuth2} authClient
   * @param {string} fileId
   * @returns {Promise<string>}
   */
  async getFileContent(authClient, fileId) {
    const driveClient = getDriveClient(authClient);
    const response = await driveClient.files.export({
      fileId,
      mimeType: 'text/plain',
    });

    return response.data;
  }

  /**
   * Obtiene el link de un archivo de Google Drive
   * @param {string} fileId
   * @returns {string}
   */
  getFileLink(fileId) {
    return `https://docs.google.com/document/d/${fileId}/edit`;
  }

  /**
   * Busca archivos por nombre en una carpeta
   * @param {google.auth.OAuth2} authClient
   * @param {string} query - Texto a buscar en el nombre
   * @param {string} folderId
   * @returns {Promise<Array>}
   */
  async searchFiles(authClient, query, folderId) {
    const driveClient = getDriveClient(authClient);
    const response = await driveClient.files.list({
      q: `'${folderId}' in parents and name contains '${query}' and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime, createdTime)',
      orderBy: 'name',
      pageSize: 50,
    });

    return response.data.files || [];
  }
}

module.exports = { DriveService };
