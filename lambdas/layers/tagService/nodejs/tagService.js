/**
 * TagService - Servicio compartido para gestión de etiquetas
 * Usado por todas las Lambdas que manejan recursos etiquetables
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const TAGS_TABLE = process.env.AWS_DYNAMODB_TABLE_TAGS;

// Límites configurables
const TAG_LIMITS = {
  MAX_TAGS_PER_RESOURCE: 10,
  MAX_TAG_NAME_LENGTH: 50,
  MIN_TAG_NAME_LENGTH: 2,
  RESERVED_CHARS: /[#@/\\<>]/g
};

class TagService {
  /**
   * Acepta múltiples formatos de entrada:
   * - String: "tag1, tag2, tag3"
   * - Array de nombres: ["tag1", "tag2"]
   * - Array de IDs: ["uuid1", "uuid2"]
   * 
   * @param {string|array} input - Tags en cualquier formato
   * @param {string} userId - ID del usuario
   * @returns {Promise<{tagIds: string[], tagNames: string[]}>}
   */
  async parseAndResolveTags(input, userId) {
    if (!input) return { tagIds: [], tagNames: [] };
    
    let tagNames = [];
    
    // Detectar formato de entrada
    if (typeof input === 'string') {
      // Formato: "tag1, tag2, tag3"
      tagNames = input.split(',')
        .map(t => t.trim())
        .filter(Boolean);
    } else if (Array.isArray(input)) {
      // Verificar si son UUIDs o nombres
      const isUUIDs = input.length > 0 && input.every(t => 
        typeof t === 'string' && 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)
      );
      
      if (isUUIDs) {
        // Ya son IDs, validar y obtener nombres
        return await this.getTagsByIds(input);
      }
      tagNames = input;
    } else {
      throw new Error('Formato de tags inválido. Usa string o array.');
    }
    
    // Normalizar y crear/buscar tags
    return await this.findOrCreateTags(tagNames, userId);
  }
  
  /**
   * Busca tags existentes o los crea si no existen
   * @param {string[]} tagNames - Array de nombres de tags
   * @param {string} userId - ID del usuario
   * @returns {Promise<{tagIds: string[], tagNames: string[]}>}
   */
  async findOrCreateTags(tagNames, userId) {
    // Normalizar nombres
    const normalized = tagNames
      .map(name => this.normalizeTagName(name))
      .filter(name => 
        name.length >= TAG_LIMITS.MIN_TAG_NAME_LENGTH && 
        name.length <= TAG_LIMITS.MAX_TAG_NAME_LENGTH
      )
      .slice(0, TAG_LIMITS.MAX_TAGS_PER_RESOURCE);
    
    if (normalized.length === 0) {
      return { tagIds: [], tagNames: [] };
    }
    
    // Eliminar duplicados (case-insensitive)
    const uniqueNames = Array.from(
      new Set(normalized.map(n => n.toLowerCase()))
    );
    
    // Buscar tags existentes
    const existing = await this.findTagsByNames(uniqueNames, userId);
    const existingMap = new Map(
      existing.map(t => [t.name.toLowerCase(), t])
    );
    
    const tagIds = [];
    const tagNamesResult = [];
    
    for (const name of uniqueNames) {
      const key = name.toLowerCase();
      if (existingMap.has(key)) {
        // Tag existe, usar el existente
        const tag = existingMap.get(key);
        tagIds.push(tag.tagId);
        tagNamesResult.push(tag.name); // Mantener capitalización original
        // Incrementar contador de uso
        await this.incrementUsageCount(tag.tagId);
      } else {
        // Tag no existe, crear nuevo
        const newTag = await this.createTag(name, userId);
        tagIds.push(newTag.tagId);
        tagNamesResult.push(newTag.name);
      }
    }
    
    return { tagIds, tagNames: tagNamesResult };
  }
  
  /**
   * Normaliza el nombre de un tag
   * - Trim espacios
   * - Reemplaza múltiples espacios por uno
   * - Elimina caracteres reservados
   * - Capitaliza primera letra
   */
  normalizeTagName(name) {
    const cleaned = name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(TAG_LIMITS.RESERVED_CHARS, '')
      .slice(0, TAG_LIMITS.MAX_TAG_NAME_LENGTH);
    
    // Capitalizar primera letra
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }
  
  /**
   * Busca tags por nombres (case-insensitive)
   */
  async findTagsByNames(names, userId) {
    const results = [];
    
    // Query por GSI-userTags para cada nombre
    for (const name of names) {
      try {
        const res = await docClient.query({
          TableName: TAGS_TABLE,
          IndexName: 'GSI-userTags',
          KeyConditionExpression: 'userId = :uid AND #n = :name',
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: {
            ':uid': userId,
            ':name': name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
          }
        }).promise();
        
        if (res.Items && res.Items.length > 0) {
          results.push(res.Items[0]);
        }
      } catch (err) {
        console.error(`Error buscando tag "${name}":`, err);
      }
    }
    
    return results;
  }
  
  /**
   * Crea un nuevo tag en DynamoDB
   */
  async createTag(name, userId) {
    const tagId = uuidv4();
    const now = new Date().toISOString();
    
    const item = {
      tagId,
      userId,
      name: this.normalizeTagName(name),
      color: this.randomColor(),
      usageCount: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      lastModifiedBy: userId
    };
    
    await docClient.put({
      TableName: TAGS_TABLE,
      Item: item
    }).promise();
    
    return item;
  }
  
  /**
   * Incrementa el contador de uso de un tag
   */
  async incrementUsageCount(tagId) {
    try {
      await docClient.update({
        TableName: TAGS_TABLE,
        Key: { tagId },
        UpdateExpression: 'ADD usageCount :inc SET updatedAt = :now',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':now': new Date().toISOString()
        }
      }).promise();
    } catch (err) {
      console.error(`Error incrementando usageCount para ${tagId}:`, err);
    }
  }
  
  /**
   * Obtiene tags por sus IDs
   */
  async getTagsByIds(tagIds) {
    if (!tagIds || tagIds.length === 0) {
      return { tagIds: [], tagNames: [] };
    }
    
    const results = await Promise.all(
      tagIds.map(id => 
        docClient.get({
          TableName: TAGS_TABLE,
          Key: { tagId: id }
        }).promise()
      )
    );
    
    const items = results
      .map(r => r.Item)
      .filter(Boolean);
    
    return {
      tagIds: items.map(t => t.tagId),
      tagNames: items.map(t => t.name)
    };
  }
  
  /**
   * Genera un color aleatorio de una paleta predefinida
   */
  randomColor() {
    const colors = [
      '#FF6B6B', // Rojo
      '#4ECDC4', // Turquesa
      '#45B7D1', // Azul
      '#FFA07A', // Salmón
      '#98D8C8', // Verde menta
      '#F7DC6F', // Amarillo
      '#BB8FCE', // Púrpura
      '#85C1E2', // Azul claro
      '#F8B739', // Naranja
      '#52C41A', // Verde
      '#FA8C16', // Naranja oscuro
      '#13C2C2', // Cyan
      '#EB2F96', // Magenta
      '#722ED1', // Púrpura oscuro
      '#FA541C'  // Rojo naranja
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /**
   * Valida que un array de tagIds sea válido
   */
  validateTagIds(tagIds) {
    if (!Array.isArray(tagIds)) return false;
    if (tagIds.length > TAG_LIMITS.MAX_TAGS_PER_RESOURCE) return false;
    
    return tagIds.every(id => 
      typeof id === 'string' && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  }
}

module.exports = { TagService, TAG_LIMITS };
