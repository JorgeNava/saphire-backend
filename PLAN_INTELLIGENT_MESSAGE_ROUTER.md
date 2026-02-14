# Plan: Intelligent Message Router (IMR)

> **Fecha**: Noviembre 9, 2024  
> **Versión**: 1.0  
> **Estado**: Planificación

## 📋 Resumen Ejecutivo

Implementar un sistema inteligente de enrutamiento de mensajes que utiliza IA para:
1. **Identificar la intención** del mensaje del usuario
2. **Clasificar automáticamente** en: Nota, Lista o Pensamiento
3. **Asignar tags inteligentes** (1-3 tags) **SOLO si el usuario no especificó tags explícitos**
4. **Ejecutar la acción correspondiente** de forma automática

**⚠️ Importante**: Los tags automáticos solo se generan cuando el usuario NO proporciona tags explícitos.

### Nombre del Sistema
**IMR (Intelligent Message Router)** - Router Inteligente de Mensajes

---

## 1. Arquitectura del Sistema

### 1.1 Flujo General (Nuevo Workflow)

```
Usuario → POST /messages
            ↓
    1. Guardar en Messages (BD)
       - conversationId
       - content
       - sender
       - tags (si vienen)
       - isThought: false (default)
            ↓
    2. Invocar IMR (async)
            ↓
    3. Clasificación IA
       - Tipo: note/list/thought
       - Tags (solo si no vienen explícitos)
            ↓
    4. Acción según tipo
       ├─→ thought: Actualizar isThought=true + crear Thought
       ├─→ note: Crear Note
       └─→ list: Crear List
            ↓
    5. Actualizar Message con resultado
       - intent: "note"/"list"/"thought"
       - processedAt: timestamp
            ↓
    Respuesta al Usuario
```

**Ventajas del nuevo flujo**:
- ✅ Mensaje siempre se guarda primero (no se pierde)
- ✅ Procesamiento asíncrono (no bloquea respuesta)
- ✅ Trazabilidad completa (mensaje original + recurso creado)
- ✅ Recuperación ante fallos del IMR

### 1.2 Componentes

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                           │
│              POST /messages/intelligent                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│          Lambda: intelligentMessageRouter                │
│                                                           │
│  1. Recibe mensaje del usuario                           │
│  2. Llama a OpenAI para clasificación                    │
│  3. Extrae intención y tags sugeridos                    │
│  4. Invoca lambda correspondiente                        │
│  5. Retorna resultado al usuario                         │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ↓            ↓            ↓
   ┌────────┐  ┌────────┐  ┌──────────┐
   │ Create │  │ Create │  │  Create  │
   │  Note  │  │  List  │  │ Thought  │
   └────────┘  └────────┘  └──────────┘
```

---

## 2. Actualización del Modelo Messages

### 2.1 Nuevos Campos

El recurso **Messages** debe actualizarse para soportar:

```typescript
interface Message {
  // Campos existentes
  conversationId: string;
  timestamp: string;
  messageId: string;
  sender: string;
  content: string;
  inputType: string;
  tagIds: string[];
  tagNames: string[];
  tagSource: string | null;
  createdAt: string;
  updatedAt: string;
  intent: string | null;
  
  // NUEVOS CAMPOS
  isThought: boolean;           // Indica si el mensaje es un thought
  processedAt?: string;         // Timestamp de procesamiento por IMR
  processedBy?: string;         // "IMR" o "Manual"
  resourceId?: string;          // ID del recurso creado (noteId/listId/thoughtId)
  resourceType?: string;        // "note" | "list" | "thought"
}
```

### 2.2 Valores por Defecto

Al crear un mensaje:
```javascript
{
  isThought: false,           // Default: no es thought hasta que IMR lo determine
  processedAt: null,
  processedBy: null,
  resourceId: null,
  resourceType: null,
  intent: null                // Se actualiza después del procesamiento
}
```

### 2.3 Actualización Post-Procesamiento

Después de que IMR procesa el mensaje:

**Si es Thought**:
```javascript
{
  isThought: true,
  intent: "thought",
  resourceType: "thought",
  resourceId: "thought-uuid",
  processedAt: "2024-11-09T...",
  processedBy: "IMR"
}
```

**Si es Note**:
```javascript
{
  isThought: false,
  intent: "note",
  resourceType: "note",
  resourceId: "note-uuid",
  processedAt: "2024-11-09T...",
  processedBy: "IMR"
}
```

**Si es List**:
```javascript
{
  isThought: false,
  intent: "list",
  resourceType: "list",
  resourceId: "list-uuid",
  processedAt: "2024-11-09T...",
  processedBy: "IMR"
}
```

### 2.4 Migración de Tabla Messages

**Agregar campos a DynamoDB**:
```javascript
// No requiere migración de datos existentes
// Los nuevos campos son opcionales
// Mensajes existentes funcionarán sin estos campos
```

---

## 3. Clasificación con IA

### 2.1 Modelo de OpenAI

**Modelo recomendado**: `gpt-4o-mini` o `gpt-3.5-turbo`
- Rápido y económico
- Suficiente para clasificación
- Buena precisión en español

### 2.2 Prompt de Clasificación

```javascript
const classificationPrompt = `
Eres un asistente inteligente que clasifica mensajes de usuarios.

Tu tarea es analizar el mensaje y determinar:
1. TIPO: Si el usuario quiere crear una Nota, Lista o Pensamiento
2. TAGS: Sugerir 1-3 etiquetas relevantes (SOLO si no se proporcionaron tags explícitos)

CRITERIOS DE CLASIFICACIÓN:

NOTA:
- Información estructurada que necesita ser guardada
- Tiene título implícito o explícito
- Contiene detalles importantes
- Puede tener múltiples párrafos
- Ejemplos: "Nota: Reunión con cliente...", "Guardar esta información...", "Apuntar que..."

LISTA:
- Múltiples items o tareas
- Usa palabras como: "lista", "comprar", "hacer", "tareas", "pendientes"
- Enumera cosas
- Ejemplos: "Comprar leche, pan y huevos", "Tareas: llamar a Juan, revisar reporte"

PENSAMIENTO:
- Reflexión personal o idea suelta
- No es estructurado
- Observación del momento
- Ejemplos: "Hoy fue un buen día", "Me pregunto si...", "Recordar que..."

TAGS:
- Máximo 3 etiquetas
- Palabras clave relevantes
- En español, minúsculas
- Ejemplos: "trabajo", "personal", "urgente", "ideas", "compras"

RESPONDE EN FORMATO JSON:
{
  "type": "note" | "list" | "thought",
  "confidence": 0.0-1.0,
  "tags": ["tag1", "tag2", "tag3"],
  "reasoning": "breve explicación"
}

MENSAJE DEL USUARIO:
"${userMessage}"

RESPUESTA (solo JSON):
`;
```

### 2.3 Ejemplos de Clasificación

**Ejemplo 1: Nota**
```
Input: "Nota sobre la reunión de hoy: Discutimos el nuevo proyecto, 
        presupuesto aprobado de $50k, inicio el 15 de noviembre"

Output:
{
  "type": "note",
  "confidence": 0.95,
  "tags": ["reunión", "proyecto", "trabajo"],
  "reasoning": "Contiene información estructurada con detalles específicos"
}
```

**Ejemplo 2: Lista**
```
Input: "Comprar leche, pan integral, huevos, café y azúcar"

Output:
{
  "type": "list",
  "confidence": 0.98,
  "tags": ["compras", "supermercado", "alimentos"],
  "reasoning": "Enumera múltiples items para comprar"
}
```

**Ejemplo 3: Pensamiento**
```
Input: "Hoy me di cuenta de que necesito organizar mejor mi tiempo"

Output:
{
  "type": "thought",
  "confidence": 0.90,
  "tags": ["reflexión", "productividad", "personal"],
  "reasoning": "Reflexión personal sin estructura específica"
}
```

---

## 3. Implementación

### 3.1 Actualización de createMessage

**Ubicación**: `lambdas/messages/createMessage/index.js`

**Cambios necesarios**:
1. Agregar nuevos campos al guardar mensaje
2. Invocar IMR de forma asíncrona después de guardar
3. Retornar respuesta inmediata al usuario

**Código actualizado**:

```javascript
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
const tagService = new TagService();

const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const IMR_LAMBDA = process.env.LAMBDA_NAME_INTELLIGENT_MESSAGE_ROUTER;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const conversationId = body.conversationId || body.userId;
    const { sender, content, tags, tagNames: inputTagNames } = body;
    
    if (!conversationId || !sender || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'conversationId (o userId), sender y content son requeridos.' 
        })
      };
    }

    // Resolver tags si se proporcionan
    const tagsToResolve = tags || inputTagNames;
    let tagIds = [];
    let tagNames = [];
    let tagSource = null;
    
    if (tagsToResolve) {
      const resolved = await tagService.parseAndResolveTags(tagsToResolve, sender);
      tagIds = resolved.tagIds;
      tagNames = resolved.tagNames;
      tagSource = 'Manual';
    }

    // 1) Guardar mensaje con nuevos campos
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const baseItem = {
      conversationId,
      timestamp,
      messageId,
      sender,
      content,
      inputType: 'text',
      tagIds,
      tagNames,
      tagSource,
      createdAt: timestamp,
      updatedAt: timestamp,
      
      // NUEVOS CAMPOS
      isThought: false,        // Default: no es thought
      intent: null,            // Se actualiza después
      processedAt: null,
      processedBy: null,
      resourceId: null,
      resourceType: null
    };

    await docClient.put({
      TableName: MSG_TABLE,
      Item: baseItem
    }).promise();

    // 2) Invocar IMR de forma asíncrona (no esperar respuesta)
    const imrPayload = {
      messageId,
      conversationId,
      timestamp,
      sender,
      content,
      explicitTags: tagsToResolve ? tagNames : null  // Pasar tags explícitos
    };
    
    // Invocación asíncrona (Event)
    lambda.invoke({
      FunctionName: IMR_LAMBDA,
      InvocationType: 'Event',  // Asíncrono
      Payload: JSON.stringify(imrPayload)
    }).promise().catch(err => {
      console.error('Error invocando IMR:', err);
      // No fallar la creación del mensaje si IMR falla
    });

    // 3) Retornar respuesta inmediata al usuario
    return {
      statusCode: 201,
      body: JSON.stringify({
        ...baseItem,
        processing: true,  // Indica que se está procesando
        message: 'Mensaje guardado, procesando en segundo plano'
      })
    };

  } catch (err) {
    console.error('createMessage error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al crear el mensaje.' })
    };
  }
};
```

### 3.2 Lambda: intelligentMessageRouter

**Ubicación**: `lambdas/messages/intelligentMessageRouter/index.js`

**Responsabilidades**:
1. Recibir datos del mensaje desde createMessage
2. Llamar a OpenAI para clasificación
3. Generar tags SOLO si no vienen explícitos
4. Invocar lambda correspondiente
5. Actualizar mensaje original con resultado

**Código Base**:

```javascript
const AWS = require('aws-sdk');
const OpenAI = require('openai');
const { TagService } = require('/opt/nodejs/tagService');

const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION });
const lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
const tagService = new TagService();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MSG_TABLE = process.env.AWS_DYNAMODB_TABLE_MESSAGES;
const LAMBDA_CREATE_NOTE = process.env.LAMBDA_NAME_CREATE_NOTE;
const LAMBDA_CREATE_LIST = process.env.LAMBDA_NAME_CREATE_LIST;
const LAMBDA_CREATE_THOUGHT = process.env.LAMBDA_NAME_CREATE_THOUGHT;

exports.handler = async (event) => {
  try {
    // Recibir datos del mensaje
    const { messageId, conversationId, timestamp, sender, content, explicitTags } = event;
    
    if (!messageId || !conversationId || !content) {
      console.error('Faltan parámetros requeridos');
      return;
    }
    
    console.log(`Procesando mensaje ${messageId}...`);
    
    // 1. Clasificar con IA
    console.log('Clasificando mensaje con IA...');
    const classification = await classifyMessage(content);
    
    // 2. Determinar tags a usar
    let tags = [];
    let tagIds = [];
    let tagSource = null;
    
    if (explicitTags && explicitTags.length > 0) {
      // Usuario proporcionó tags explícitos - USAR ESOS
      tags = explicitTags;
      tagSource = 'Manual';
      console.log('Usando tags explícitos del usuario:', tags);
    } else {
      // NO hay tags explícitos - GENERAR CON IA
      tags = classification.tags || [];
      tagSource = 'AI';
      console.log('Generando tags con IA:', tags);
      
      // Resolver tags con TagService
      if (tags.length > 0) {
        const resolved = await tagService.parseAndResolveTags(tags, sender);
        tagIds = resolved.tagIds;
        tags = resolved.tagNames;
      }
    }
    
    // 3. Preparar payload según tipo
    const userId = conversationId;  // conversationId es el userId
    const payload = {
      userId,
      content,
      tags,
      tagIds,
      createdBy: 'IMR'
    };
    
    // 4. Invocar lambda correspondiente y obtener resultado
    let targetLambda;
    let result;
    let resourceType;
    let isThought = false;
    
    switch (classification.type) {
      case 'note':
        targetLambda = LAMBDA_CREATE_NOTE;
        resourceType = 'note';
        // Extraer título del mensaje
        payload.title = await extractTitle(content);
        result = await invokeLambda(targetLambda, payload);
        break;
        
      case 'list':
        targetLambda = LAMBDA_CREATE_LIST;
        resourceType = 'list';
        // Extraer nombre e items de la lista
        const listData = await extractListData(content);
        payload.name = listData.name;
        payload.items = listData.items;
        result = await invokeLambda(targetLambda, payload);
        break;
        
      case 'thought':
        targetLambda = LAMBDA_CREATE_THOUGHT;
        resourceType = 'thought';
        isThought = true;  // Marcar como thought
        result = await invokeLambda(targetLambda, payload);
        break;
        
      default:
        // Default: crear como pensamiento
        targetLambda = LAMBDA_CREATE_THOUGHT;
        resourceType = 'thought';
        isThought = true;
        result = await invokeLambda(targetLambda, payload);
    }
    
    // 5. Actualizar mensaje original con resultado del procesamiento
    const now = new Date().toISOString();
    const resourceId = result.noteId || result.listId || result.thoughtId;
    
    await docClient.update({
      TableName: MSG_TABLE,
      Key: { conversationId, timestamp },
      UpdateExpression: `
        SET isThought = :isThought,
            intent = :intent,
            resourceType = :resourceType,
            resourceId = :resourceId,
            processedAt = :processedAt,
            processedBy = :processedBy,
            updatedAt = :updatedAt
            ${!explicitTags && tagIds.length > 0 ? ', tagIds = :tagIds, tagNames = :tagNames, tagSource = :tagSource' : ''}
      `,
      ExpressionAttributeValues: {
        ':isThought': isThought,
        ':intent': classification.type,
        ':resourceType': resourceType,
        ':resourceId': resourceId,
        ':processedAt': now,
        ':processedBy': 'IMR',
        ':updatedAt': now,
        ...(!explicitTags && tagIds.length > 0 && {
          ':tagIds': tagIds,
          ':tagNames': tags,
          ':tagSource': tagSource
        })
      }
    }).promise();
    
    console.log(`Mensaje ${messageId} procesado exitosamente como ${resourceType}`);
    console.log(`Recurso creado: ${resourceId}`);
    
    // 6. Retornar (aunque es invocación asíncrona)
    return {
      success: true,
      messageId,
      classification: classification.type,
      resourceId,
      resourceType,
      tagsUsed: tags,
      tagsSource: tagSource
    };
    
  } catch (err) {
    console.error('Error en intelligentMessageRouter:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Error al procesar mensaje',
        details: err.message
      })
    };
  }
};

async function classifyMessage(message) {
  const prompt = `
Eres un asistente inteligente que clasifica mensajes de usuarios.

Tu tarea es analizar el mensaje y determinar:
1. TIPO: Si el usuario quiere crear una Nota, Lista o Pensamiento
2. TAGS: Sugerir 1-3 etiquetas relevantes

CRITERIOS DE CLASIFICACIÓN:

NOTA:
- Información estructurada que necesita ser guardada
- Tiene título implícito o explícito
- Contiene detalles importantes
- Puede tener múltiples párrafos
- Ejemplos: "Nota: Reunión con cliente...", "Guardar esta información...", "Apuntar que..."

LISTA:
- Múltiples items o tareas
- Usa palabras como: "lista", "comprar", "hacer", "tareas", "pendientes"
- Enumera cosas
- Ejemplos: "Comprar leche, pan y huevos", "Tareas: llamar a Juan, revisar reporte"

PENSAMIENTO:
- Reflexión personal o idea suelta
- No es estructurado
- Observación del momento
- Ejemplos: "Hoy fue un buen día", "Me pregunto si...", "Recordar que..."

TAGS:
- Máximo 3 etiquetas
- Palabras clave relevantes
- En español, minúsculas
- Ejemplos: "trabajo", "personal", "urgente", "ideas", "compras"

RESPONDE EN FORMATO JSON:
{
  "type": "note" | "list" | "thought",
  "confidence": 0.0-1.0,
  "tags": ["tag1", "tag2", "tag3"],
  "reasoning": "breve explicación"
}

MENSAJE DEL USUARIO:
"${message}"

RESPUESTA (solo JSON):
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Eres un clasificador de mensajes. Respondes solo con JSON válido.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 200
  });
  
  const content = response.choices[0].message.content.trim();
  
  // Extraer JSON de la respuesta
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No se pudo extraer JSON de la respuesta de IA');
  }
  
  const classification = JSON.parse(jsonMatch[0]);
  
  // Validar y normalizar
  if (!['note', 'list', 'thought'].includes(classification.type)) {
    classification.type = 'thought'; // Default
  }
  
  if (!Array.isArray(classification.tags)) {
    classification.tags = [];
  }
  
  // Limitar a 3 tags
  classification.tags = classification.tags.slice(0, 3);
  
  return classification;
}

async function extractTitle(message) {
  // Extraer título del mensaje usando IA
  const prompt = `
Extrae un título conciso (máximo 60 caracteres) del siguiente mensaje.
Si el mensaje ya tiene un título explícito (ej: "Nota: ..."), úsalo.
Si no, genera uno descriptivo.

Mensaje: "${message}"

Título:
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 50
  });
  
  return response.choices[0].message.content.trim();
}

async function extractListData(message) {
  // Extraer nombre de lista e items usando IA
  const prompt = `
Extrae del siguiente mensaje:
1. Un nombre para la lista (máximo 50 caracteres)
2. Los items individuales de la lista

Responde en JSON:
{
  "name": "nombre de la lista",
  "items": ["item1", "item2", "item3"]
}

Mensaje: "${message}"

JSON:
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 300
  });
  
  const content = response.choices[0].message.content.trim();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    // Fallback: usar mensaje completo
    return {
      name: 'Lista sin nombre',
      items: [message]
    };
  }
  
  return JSON.parse(jsonMatch[0]);
}

async function invokeLambda(functionName, payload) {
  const response = await lambda.invoke({
    FunctionName: functionName,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify({ body: JSON.stringify(payload) })
  }).promise();
  
  const result = JSON.parse(response.Payload);
  return JSON.parse(result.body);
}
```

### 3.2 Dependencias

**package.json**:
```json
{
  "name": "intelligent-message-router",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1691.0",
    "openai": "^4.20.0"
  }
}
```

---

## 4. Configuración de Terraform

### 4.1 Variables de Entorno

```hcl
resource "aws_lambda_function" "intelligent_message_router" {
  # ... configuración básica ...
  
  environment {
    variables = {
      AWS_REGION                    = var.aws_region
      OPENAI_API_KEY               = var.openai_api_key
      LAMBDA_NAME_CREATE_NOTE      = aws_lambda_function.createNote.function_name
      LAMBDA_NAME_CREATE_LIST      = aws_lambda_function.createList.function_name
      LAMBDA_NAME_CREATE_THOUGHT   = aws_lambda_function.createThought.function_name
    }
  }
  
  # Timeout más largo por llamadas a OpenAI
  timeout = 30
  memory_size = 512
}
```

### 4.2 Permisos IAM

```hcl
resource "aws_iam_role_policy" "imr_invoke_lambdas" {
  name = "imr-invoke-lambdas"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.createNote.arn,
          aws_lambda_function.createList.arn,
          aws_lambda_function.createThought.arn
        ]
      }
    ]
  })
}
```

### 4.3 API Gateway

```hcl
locals {
  routes = {
    # ... rutas existentes ...
    intelligentMessageRouter = { 
      method = "POST", 
      path = "/messages/intelligent" 
    }
  }
}
```

---

## 5. Endpoint de API

### 5.1 Request

**POST /messages/intelligent**

```json
{
  "userId": "user-123",
  "message": "Comprar leche, pan y huevos para el desayuno",
  "explicitTags": ["compras"]  // Opcional
}
```

### 5.2 Response

```json
{
  "classification": {
    "type": "list",
    "confidence": 0.95,
    "suggestedTags": ["compras", "supermercado", "alimentos"],
    "usedTags": ["compras"]
  },
  "result": {
    "listId": "list-uuid",
    "userId": "user-123",
    "name": "Compras para el desayuno",
    "items": [
      {
        "itemId": "item-1",
        "content": "leche",
        "completed": false
      },
      {
        "itemId": "item-2",
        "content": "pan",
        "completed": false
      },
      {
        "itemId": "item-3",
        "content": "huevos",
        "completed": false
      }
    ],
    "tagNames": ["Compras"],
    "createdAt": "2024-11-09T..."
  }
}
```

---

## 6. Casos de Uso

### 6.1 Caso 1: Crear Nota Automáticamente

**Input**:
```json
{
  "userId": "user-123",
  "message": "Reunión con el cliente: Discutimos el presupuesto del Q1, aprobaron $100k para marketing digital. Próxima reunión el 20 de noviembre."
}
```

**Clasificación IA**:
```json
{
  "type": "note",
  "confidence": 0.92,
  "tags": ["reunión", "cliente", "presupuesto"]
}
```

**Acción**: Crea nota con título "Reunión con el cliente - Presupuesto Q1"

### 6.2 Caso 2: Crear Lista Automáticamente

**Input**:
```json
{
  "userId": "user-123",
  "message": "Pendientes de hoy: llamar a Juan, revisar el reporte de ventas, enviar email a María, preparar presentación"
}
```

**Clasificación IA**:
```json
{
  "type": "list",
  "confidence": 0.96,
  "tags": ["trabajo", "pendientes", "tareas"]
}
```

**Acción**: Crea lista "Pendientes de hoy" con 4 items

### 6.3 Caso 3: Registrar Pensamiento

**Input**:
```json
{
  "userId": "user-123",
  "message": "Hoy me di cuenta de que necesito mejorar mi comunicación con el equipo"
}
```

**Clasificación IA**:
```json
{
  "type": "thought",
  "confidence": 0.88,
  "tags": ["reflexión", "equipo", "comunicación"]
}
```

**Acción**: Registra como pensamiento

---

## 7. Optimizaciones

### 7.1 Caché de Clasificaciones

Para mensajes similares, cachear la clasificación:

```javascript
const cache = new Map();

function getCacheKey(message) {
  // Normalizar mensaje para caché
  return message.toLowerCase().trim().substring(0, 100);
}

async function classifyWithCache(message) {
  const key = getCacheKey(message);
  
  if (cache.has(key)) {
    console.log('Cache hit');
    return cache.get(key);
  }
  
  const classification = await classifyMessage(message);
  cache.set(key, classification);
  
  return classification;
}
```

### 7.2 Fallback sin IA

Si OpenAI falla, usar clasificación basada en reglas:

```javascript
function classifyWithRules(message) {
  const lower = message.toLowerCase();
  
  // Detectar listas
  if (lower.includes('comprar') || 
      lower.includes('lista') || 
      lower.includes('tareas') ||
      lower.match(/,.*,/)) {
    return {
      type: 'list',
      confidence: 0.7,
      tags: ['general'],
      reasoning: 'Clasificación por reglas'
    };
  }
  
  // Detectar notas
  if (lower.includes('nota') || 
      lower.includes('guardar') || 
      lower.includes('apuntar') ||
      message.length > 200) {
    return {
      type: 'note',
      confidence: 0.7,
      tags: ['general'],
      reasoning: 'Clasificación por reglas'
    };
  }
  
  // Default: pensamiento
  return {
    type: 'thought',
    confidence: 0.6,
    tags: ['general'],
    reasoning: 'Clasificación por reglas (default)'
  };
}
```

### 7.3 Batch Processing

Para múltiples mensajes, procesar en batch:

```javascript
async function classifyBatch(messages) {
  const prompt = `
Clasifica los siguientes mensajes...

Mensajes:
${messages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}

Responde con array JSON:
[
  {"id": 1, "type": "...", "tags": [...], "confidence": 0.0},
  ...
]
`;

  // Procesar con OpenAI
  // ...
}
```

---

## 8. Monitoreo y Analytics

### 8.1 Métricas a Trackear

```javascript
// CloudWatch Metrics
await cloudwatch.putMetricData({
  Namespace: 'IMR',
  MetricData: [
    {
      MetricName: 'ClassificationConfidence',
      Value: classification.confidence,
      Unit: 'None'
    },
    {
      MetricName: 'ClassificationType',
      Value: 1,
      Dimensions: [
        { Name: 'Type', Value: classification.type }
      ]
    },
    {
      MetricName: 'OpenAILatency',
      Value: latencyMs,
      Unit: 'Milliseconds'
    }
  ]
}).promise();
```

### 8.2 Logging

```javascript
console.log(JSON.stringify({
  event: 'message_classified',
  userId,
  messageLength: message.length,
  classification: classification.type,
  confidence: classification.confidence,
  suggestedTags: classification.tags,
  latencyMs,
  timestamp: new Date().toISOString()
}));
```

---

## 9. Testing

### 9.1 Test Cases

```javascript
const testCases = [
  {
    message: "Comprar leche, pan y huevos",
    expectedType: "list",
    minConfidence: 0.8
  },
  {
    message: "Nota: Reunión importante mañana a las 10am",
    expectedType: "note",
    minConfidence: 0.85
  },
  {
    message: "Hoy fue un buen día",
    expectedType: "thought",
    minConfidence: 0.7
  },
  {
    message: "Tareas pendientes: llamar a Juan, revisar reporte",
    expectedType: "list",
    minConfidence: 0.8
  }
];
```

### 9.2 Integration Tests

```bash
# Test clasificación
curl -X POST https://api/messages/intelligent \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "message": "Comprar leche y pan"
  }'
```

---

## 10. Costos Estimados

### 10.1 OpenAI API

**Modelo**: gpt-4o-mini
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens

**Estimación por mensaje**:
- Prompt: ~300 tokens
- Response: ~100 tokens
- Costo: ~$0.0001 por mensaje

**1000 mensajes/día**: ~$3/mes

### 10.2 Lambda

- Ejecución: ~500ms promedio
- Memoria: 512MB
- Costo: ~$0.0000083 por invocación

**1000 mensajes/día**: ~$0.25/mes

**Total estimado**: ~$3.25/mes para 1000 mensajes/día

---

## 11. Roadmap

### Fase 1: MVP (1 semana)
- [ ] Implementar `intelligentMessageRouter` lambda
- [ ] Integrar OpenAI para clasificación
- [ ] Implementar extracción de título y lista
- [ ] Configurar Terraform
- [ ] Tests básicos

### Fase 2: Optimización (1 semana)
- [ ] Implementar caché de clasificaciones
- [ ] Agregar fallback con reglas
- [ ] Mejorar prompts de IA
- [ ] Agregar métricas y logging
- [ ] Tests de integración

### Fase 3: Features Avanzadas (1-2 semanas)
- [ ] Batch processing
- [ ] Aprendizaje de preferencias del usuario
- [ ] Sugerencias contextuales
- [ ] Dashboard de analytics

---

## 12. Workflow Completo - Resumen

### 12.1 Flujo Paso a Paso

```
1. Usuario envía mensaje
   POST /messages
   {
     "conversationId": "user-123",
     "sender": "user-123",
     "content": "Comprar leche y pan",
     "tags": ["compras"]  // OPCIONAL
   }

2. createMessage Lambda
   ├─ Resolver tags si vienen explícitos
   ├─ Guardar mensaje en DynamoDB
   │  └─ isThought: false (default)
   │  └─ intent: null
   │  └─ processedAt: null
   ├─ Invocar IMR (asíncrono)
   └─ Retornar respuesta inmediata
      {
        "messageId": "msg-uuid",
        "processing": true,
        "message": "Mensaje guardado, procesando en segundo plano"
      }

3. IMR Lambda (procesamiento asíncrono)
   ├─ Clasificar con OpenAI
   │  └─ Tipo: "list"
   │  └─ Confidence: 0.95
   │  └─ Tags sugeridos: ["compras", "supermercado"]
   │
   ├─ Determinar tags a usar
   │  ├─ SI hay tags explícitos → usar esos
   │  └─ SI NO hay tags → usar sugeridos por IA
   │
   ├─ Extraer datos según tipo
   │  └─ Lista: nombre + items
   │
   ├─ Invocar lambda correspondiente
   │  └─ createList
   │     └─ Retorna: { listId, name, items, ... }
   │
   └─ Actualizar mensaje original
      └─ isThought: false
      └─ intent: "list"
      └─ resourceType: "list"
      └─ resourceId: "list-uuid"
      └─ processedAt: "2024-11-09T..."
      └─ processedBy: "IMR"
      └─ tagIds/tagNames (solo si se generaron con IA)

4. Resultado Final
   - Mensaje guardado en Messages
   - Lista creada en Lists
   - Mensaje actualizado con referencia a la lista
   - Tags aplicados (explícitos o generados)
```

### 12.2 Ejemplo Completo con Tags Explícitos

**Request**:
```json
POST /messages
{
  "conversationId": "user-123",
  "sender": "user-123",
  "content": "Comprar leche, pan y huevos",
  "tags": ["compras", "urgente"]
}
```

**Mensaje guardado (inicial)**:
```json
{
  "conversationId": "user-123",
  "timestamp": "2024-11-09T20:00:00Z",
  "messageId": "msg-001",
  "sender": "user-123",
  "content": "Comprar leche, pan y huevos",
  "tagIds": ["tag-1", "tag-2"],
  "tagNames": ["Compras", "Urgente"],
  "tagSource": "Manual",
  "isThought": false,
  "intent": null,
  "processedAt": null
}
```

**IMR procesa**:
- Clasificación: "list" (confidence: 0.98)
- Tags sugeridos por IA: ["compras", "supermercado", "alimentos"]
- **Tags usados**: ["Compras", "Urgente"] ← EXPLÍCITOS (no se usan los de IA)

**Lista creada**:
```json
{
  "listId": "list-001",
  "userId": "user-123",
  "name": "Compras",
  "items": [
    { "itemId": "item-1", "content": "leche" },
    { "itemId": "item-2", "content": "pan" },
    { "itemId": "item-3", "content": "huevos" }
  ],
  "tagIds": ["tag-1", "tag-2"],
  "tagNames": ["Compras", "Urgente"]
}
```

**Mensaje actualizado (final)**:
```json
{
  "conversationId": "user-123",
  "timestamp": "2024-11-09T20:00:00Z",
  "messageId": "msg-001",
  "sender": "user-123",
  "content": "Comprar leche, pan y huevos",
  "tagIds": ["tag-1", "tag-2"],
  "tagNames": ["Compras", "Urgente"],
  "tagSource": "Manual",
  "isThought": false,
  "intent": "list",
  "resourceType": "list",
  "resourceId": "list-001",
  "processedAt": "2024-11-09T20:00:05Z",
  "processedBy": "IMR"
}
```

### 12.3 Ejemplo Completo SIN Tags (IA los genera)

**Request**:
```json
POST /messages
{
  "conversationId": "user-123",
  "sender": "user-123",
  "content": "Hoy tuve una reunión importante sobre el proyecto"
}
```

**Mensaje guardado (inicial)**:
```json
{
  "conversationId": "user-123",
  "timestamp": "2024-11-09T20:10:00Z",
  "messageId": "msg-002",
  "sender": "user-123",
  "content": "Hoy tuve una reunión importante sobre el proyecto",
  "tagIds": [],
  "tagNames": [],
  "tagSource": null,
  "isThought": false,
  "intent": null,
  "processedAt": null
}
```

**IMR procesa**:
- Clasificación: "thought" (confidence: 0.88)
- **Tags generados por IA**: ["reunión", "trabajo", "proyecto"] ← SE USAN porque no había explícitos

**Thought creado**:
```json
{
  "thoughtId": "thought-001",
  "userId": "user-123",
  "content": "Hoy tuve una reunión importante sobre el proyecto",
  "tagIds": ["tag-3", "tag-4", "tag-5"],
  "tagNames": ["Reunión", "Trabajo", "Proyecto"],
  "tagSource": "AI"
}
```

**Mensaje actualizado (final)**:
```json
{
  "conversationId": "user-123",
  "timestamp": "2024-11-09T20:10:00Z",
  "messageId": "msg-002",
  "sender": "user-123",
  "content": "Hoy tuve una reunión importante sobre el proyecto",
  "tagIds": ["tag-3", "tag-4", "tag-5"],
  "tagNames": ["Reunión", "Trabajo", "Proyecto"],
  "tagSource": "AI",
  "isThought": true,
  "intent": "thought",
  "resourceType": "thought",
  "resourceId": "thought-001",
  "processedAt": "2024-11-09T20:10:03Z",
  "processedBy": "IMR"
}
```

---

## 13. Beneficios

**Para el Usuario**:
- ✅ Experiencia simplificada (un solo endpoint)
- ✅ No necesita especificar tipo de recurso
- ✅ Tags automáticos inteligentes
- ✅ Procesamiento natural del lenguaje

**Técnicos**:
- ✅ Centralización de lógica de clasificación
- ✅ Reutilización de lambdas existentes
- ✅ Escalable y mantenible
- ✅ Fácil de extender con nuevos tipos

**Negocio**:
- ✅ Reduce fricción en la captura de información
- ✅ Mejora la organización automática
- ✅ Aumenta el engagement del usuario
- ✅ Datos más ricos para analytics
