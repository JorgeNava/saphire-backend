/**
 * Lambda — exportToVault (scheduled, EventBridge diario)
 * Lee los thoughts/notes recientes de DynamoDB y escribe un roll-up markdown
 * al vault unificado "Segundo Cerebro" (JorgeNava/segundo-cerebro), carpeta
 * Pensamientos/. Cumple _sistema/CONTRATO-EXPORT.md.
 *
 * No tiene ruta de API Gateway — lo dispara una regla de EventBridge.
 * Runtime nodejs18.x: usa `fetch` global y @aws-sdk v3 (incluido en el runtime,
 * SIN deps empaquetadas ni layer).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

const THOUGHTS_TBL = process.env.AWS_DYNAMODB_TABLE_THOUGHTS;
const NOTES_TBL    = process.env.AWS_DYNAMODB_TABLE_NOTES;

const GITHUB_API   = 'https://api.github.com';
const REPO         = process.env.GITHUB_REPO   || 'JorgeNava/segundo-cerebro';
const BRANCH       = process.env.GITHUB_BRANCH || 'main';
const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

// Ventana: 26h hacia atrás (margen sobre el schedule diario).
const WINDOW_MS = 26 * 60 * 60 * 1000;

function authHeader() {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_ACCESS_TOKEN no configurado');
  return { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };
}

async function getFileSha(path) {
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`, {
    headers: authHeader(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.sha ? data.sha : null;
}

async function upsertVaultFile(path, content) {
  const sha = await getFileSha(path);
  const body = {
    message: `saphire: rollup ${path}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
}

/** Scan completo con paginación, filtrando por createdAt dentro de la ventana. */
async function recentItems(table, sinceIso) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName: table,
      FilterExpression: 'createdAt >= :since',
      ExpressionAttributeValues: { ':since': sinceIso },
      ExclusiveStartKey,
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function groupByUser(items) {
  const byUser = {};
  for (const it of items) {
    const u = it.userId || 'desconocido';
    (byUser[u] = byUser[u] || []).push(it);
  }
  return byUser;
}

function buildMarkdown(dateStr, thoughts, notes) {
  const tagLine = (t) =>
    Array.isArray(t.tagNames) && t.tagNames.length ? ` _(${t.tagNames.join(', ')})_` : '';

  const thoughtsMd = thoughts.length
    ? thoughts
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
        .map((t) => `- ${String(t.content || '').trim()}${tagLine(t)}`)
        .join('\n')
    : '_Sin pensamientos nuevos hoy._';

  const notesMd = notes.length
    ? notes
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
        .map((n) => `- **${String(n.title || 'Sin título').trim()}**`)
        .join('\n')
    : '';

  return `---
date: ${dateStr}
type: thoughts-rollup
domain: pensamientos
source: saphire
period: "${dateStr}"
tags: [pensamientos, saphire]
---

# Pensamientos — ${dateStr}

## Capturas del día (${thoughts.length})

${thoughtsMd}
${notes.length ? `\n## Notas creadas (${notes.length})\n\n${notesMd}\n` : ''}
---
*Roll-up automático de Saphire · ${new Date().toLocaleString('es-MX')}*

---
## Mis notas

`;
}

exports.handler = async () => {
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
  const dateStr = new Date().toISOString().slice(0, 10);

  const [thoughts, notes] = await Promise.all([
    recentItems(THOUGHTS_TBL, sinceIso),
    NOTES_TBL ? recentItems(NOTES_TBL, sinceIso) : Promise.resolve([]),
  ]);

  if (thoughts.length === 0 && notes.length === 0) {
    console.log('exportToVault: sin actividad reciente, nada que exportar.');
    return { statusCode: 200, body: 'no-activity' };
  }

  const thoughtsByUser = groupByUser(thoughts);
  const notesByUser = groupByUser(notes);
  const userIds = new Set([...Object.keys(thoughtsByUser), ...Object.keys(notesByUser)]);

  const written = [];
  for (const userId of userIds) {
    const md = buildMarkdown(dateStr, thoughtsByUser[userId] || [], notesByUser[userId] || []);
    // Un usuario (uso personal) → un archivo por día. Multi-usuario: subcarpeta por userId.
    const path = userIds.size > 1
      ? `Pensamientos/${userId}/${dateStr}-pensamientos.md`
      : `Pensamientos/${dateStr}-pensamientos.md`;
    await upsertVaultFile(path, md);
    written.push(path);
  }

  console.log('exportToVault: escritas', written.length, 'notas:', written.join(', '));
  return { statusCode: 200, body: JSON.stringify({ written }) };
};
