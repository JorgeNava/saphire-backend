#!/usr/bin/env node

/**
 * Script para unificar etiquetas duplicadas
 * 
 * Este script:
 * 1. Busca etiquetas con nombres duplicados (case-insensitive)
 * 2. Para cada grupo de duplicados, mantiene la más antigua
 * 3. Actualiza todas las referencias en thoughts, lists y notes
 * 4. Elimina las etiquetas duplicadas
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TAGS_TABLE = 'Zafira-Tags';
const THOUGHTS_TABLE = 'Zafira-Thoughts';
const LISTS_TABLE = 'Zafira-Lists';
const NOTES_TABLE = 'Zafira-Notes';

async function getAllTags() {
  console.log('📥 Obteniendo todas las etiquetas...');
  
  const params = {
    TableName: TAGS_TABLE
  };

  const items = [];
  let lastKey = null;

  do {
    if (lastKey) {
      params.ExclusiveStartKey = lastKey;
    }

    const result = await docClient.send(new ScanCommand(params));
    items.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`✅ Se encontraron ${items.length} etiquetas`);
  return items;
}

function findDuplicates(tags) {
  console.log('\n🔍 Buscando duplicados...');
  
  const tagsByName = {};
  
  for (const tag of tags) {
    const normalizedName = tag.name.toLowerCase().trim();
    
    if (!tagsByName[normalizedName]) {
      tagsByName[normalizedName] = [];
    }
    
    tagsByName[normalizedName].push(tag);
  }

  const duplicates = {};
  
  for (const [normalizedName, tagList] of Object.entries(tagsByName)) {
    if (tagList.length > 1) {
      // Ordenar por fecha de creación (más antigua primero)
      tagList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      duplicates[normalizedName] = tagList;
    }
  }

  console.log(`✅ Se encontraron ${Object.keys(duplicates).length} grupos de duplicados`);
  return duplicates;
}

async function updateThoughtsReferences(oldTagId, newTagId, userId) {
  console.log(`  📝 Actualizando pensamientos...`);
  
  // Buscar pensamientos con el tag antiguo
  const queryParams = {
    TableName: THOUGHTS_TABLE,
    IndexName: 'GSI-userThoughts',
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: 'contains(tagIds, :oldTagId)',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':oldTagId': oldTagId
    }
  };

  const result = await docClient.send(new QueryCommand(queryParams));
  
  for (const thought of result.Items || []) {
    const newTagIds = thought.tagIds.map(id => id === oldTagId ? newTagId : id);
    const uniqueTagIds = [...new Set(newTagIds)]; // Eliminar duplicados
    
    await docClient.send(new UpdateCommand({
      TableName: THOUGHTS_TABLE,
      Key: { thoughtId: thought.thoughtId },
      UpdateExpression: 'SET tagIds = :tagIds',
      ExpressionAttributeValues: {
        ':tagIds': uniqueTagIds
      }
    }));
  }

  console.log(`    ✅ ${result.Items?.length || 0} pensamientos actualizados`);
}

async function updateListsReferences(oldTagId, newTagId, userId) {
  console.log(`  📋 Actualizando listas...`);
  
  const scanParams = {
    TableName: LISTS_TABLE,
    FilterExpression: 'userId = :userId AND contains(tagIds, :oldTagId)',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':oldTagId': oldTagId
    }
  };

  const result = await docClient.send(new ScanCommand(scanParams));
  
  for (const list of result.Items || []) {
    const newTagIds = list.tagIds.map(id => id === oldTagId ? newTagId : id);
    const uniqueTagIds = [...new Set(newTagIds)];
    
    await docClient.send(new UpdateCommand({
      TableName: LISTS_TABLE,
      Key: { listId: list.listId },
      UpdateExpression: 'SET tagIds = :tagIds',
      ExpressionAttributeValues: {
        ':tagIds': uniqueTagIds
      }
    }));
  }

  console.log(`    ✅ ${result.Items?.length || 0} listas actualizadas`);
}

async function updateNotesReferences(oldTagId, newTagId, userId) {
  console.log(`  📓 Actualizando notas...`);
  
  const queryParams = {
    TableName: NOTES_TABLE,
    IndexName: 'GSI-userNotes',
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: 'contains(tagIds, :oldTagId)',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':oldTagId': oldTagId
    }
  };

  const result = await docClient.send(new QueryCommand(queryParams));
  
  for (const note of result.Items || []) {
    const newTagIds = note.tagIds.map(id => id === oldTagId ? newTagId : id);
    const uniqueTagIds = [...new Set(newTagIds)];
    
    await docClient.send(new UpdateCommand({
      TableName: NOTES_TABLE,
      Key: { noteId: note.noteId },
      UpdateExpression: 'SET tagIds = :tagIds',
      ExpressionAttributeValues: {
        ':tagIds': uniqueTagIds
      }
    }));
  }

  console.log(`    ✅ ${result.Items?.length || 0} notas actualizadas`);
}

async function deleteTag(tagId) {
  await docClient.send(new DeleteCommand({
    TableName: TAGS_TABLE,
    Key: { tagId }
  }));
}

async function unifyDuplicates(duplicates) {
  console.log('\n🔧 Unificando duplicados...\n');
  
  let totalUnified = 0;
  
  for (const [normalizedName, tagList] of Object.entries(duplicates)) {
    const mainTag = tagList[0]; // La más antigua
    const duplicateTags = tagList.slice(1);
    
    console.log(`\n📌 Unificando "${mainTag.name}" (${tagList.length} duplicados)`);
    console.log(`  ✅ Tag principal: ${mainTag.tagId} (creado: ${mainTag.createdAt})`);
    
    for (const duplicateTag of duplicateTags) {
      console.log(`  🔄 Procesando duplicado: ${duplicateTag.tagId} (${duplicateTag.name})`);
      
      // Actualizar referencias
      await updateThoughtsReferences(duplicateTag.tagId, mainTag.tagId, duplicateTag.userId);
      await updateListsReferences(duplicateTag.tagId, mainTag.tagId, duplicateTag.userId);
      await updateNotesReferences(duplicateTag.tagId, mainTag.tagId, duplicateTag.userId);
      
      // Eliminar tag duplicado
      await deleteTag(duplicateTag.tagId);
      console.log(`  ❌ Tag duplicado eliminado: ${duplicateTag.tagId}`);
      
      totalUnified++;
    }
  }

  console.log(`\n✅ Total de etiquetas unificadas: ${totalUnified}`);
}

async function main() {
  console.log('🚀 Iniciando unificación de etiquetas duplicadas\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Obtener todas las etiquetas
    const tags = await getAllTags();
    
    // 2. Encontrar duplicados
    const duplicates = findDuplicates(tags);
    
    if (Object.keys(duplicates).length === 0) {
      console.log('\n✅ No se encontraron etiquetas duplicadas');
      return;
    }

    // 3. Mostrar resumen
    console.log('\n📊 Resumen de duplicados:');
    for (const [normalizedName, tagList] of Object.entries(duplicates)) {
      console.log(`  • "${normalizedName}": ${tagList.length} duplicados`);
      tagList.forEach((tag, index) => {
        console.log(`    ${index === 0 ? '✅' : '  '} ${tag.name} (${tag.tagId}) - ${tag.createdAt}`);
      });
    }

    // 4. Confirmar
    console.log('\n⚠️  Esta operación:');
    console.log('   - Mantendrá la etiqueta más antigua de cada grupo');
    console.log('   - Actualizará todas las referencias en thoughts, lists y notes');
    console.log('   - Eliminará las etiquetas duplicadas');
    console.log('\n¿Deseas continuar? (y/N): ');
    
    // Para ejecución automática, comentar la confirmación
    // const readline = require('readline').createInterface({
    //   input: process.stdin,
    //   output: process.stdout
    // });
    
    // const answer = await new Promise(resolve => {
    //   readline.question('', resolve);
    // });
    
    // readline.close();
    
    // if (answer.toLowerCase() !== 'y') {
    //   console.log('\n❌ Operación cancelada');
    //   return;
    // }

    // 5. Unificar
    await unifyDuplicates(duplicates);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Proceso completado exitosamente');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
