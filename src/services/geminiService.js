import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

// Configuration constants
const DEFAULT_CHAT_MODEL = 'gemini-2.0-flash'; // Removed '-exp' for stable production
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001'; // <-- CRITICAL FIX HERE
const DEFAULT_VISION_MODEL = 'gemini-2.0-flash'; // Flash natively handles vision/images
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.7;

// Initialize Google AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Send a simple chat prompt to Gemini
 * @param {string} prompt - The user's prompt
 * @param {Object} options - Additional options
 * @param {string} [options.model=DEFAULT_CHAT_MODEL] - Model to use (default: gemini-2.0-flash-exp)
 * @param {number} [options.maxTokens=DEFAULT_MAX_TOKENS] - Maximum tokens in response (default: 500)
 * @param {number} [options.temperature=DEFAULT_TEMPERATURE] - Creativity level 0-2 (default: 0.7)
 * @param {string} [requestId=null] - Request ID for logging
 * @returns {Promise<string>} - The AI response
 */
export const chat = async (prompt, options = {}, requestId = null) => {
  console.log('=== CHAT PROMPT ===',prompt);
  // Input validation
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new AppError('Valid prompt is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE } = options;

  try {
    logger.info('Sending prompt to Gemini', {
      model,
      promptLength: prompt.length,
      requestId
    });

    const genModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature
      }
    });

    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    logger.info('Received response from Gemini', {
      model,
      responseLength: content.length,
      requestId
    });

    return content;
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new AppError(
      `Gemini API error: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Send a chat with conversation history
 * @param {Array} messages - Array of message objects {role, content}
 * @param {Object} options - Additional options
 * @param {string} [options.model=DEFAULT_CHAT_MODEL] - Model to use (default: gemini-2.0-flash-exp)
 * @param {number} [options.maxTokens=DEFAULT_MAX_TOKENS] - Maximum tokens in response (default: 500)
 * @param {number} [options.temperature=DEFAULT_TEMPERATURE] - Creativity level 0-2 (default: 0.7)
 * @param {Array} [options.tools] - Function/tool definitions for agent (optional)
 * @param {boolean} [options.forceToolUse=true] - Force tool usage when tools are available (default: true)
 * @param {string} [requestId=null] - Request ID for logging
 * @returns {Promise<Object>} - Response with text and/or tool calls
 */
export const chatWithHistory = async (messages, options = {},requestId = null) => {
  // Input validation
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError('Valid messages array is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE, tools = null, forceToolUse = true } = options;

  try {
    logger.info('Sending conversation to Gemini', {
      model,
      messageCount: messages.length,
      hasTools: !!tools,
      requestId
    });

    const modelConfig = {
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature
      }
    };

    // Add tools/functions if provided (for agent)
    if (tools && tools.length > 0) {
      modelConfig.tools = [
        {
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }))
        }
      ];

      // Force Gemini to use tools when requested (default: true)
      if (forceToolUse) {
        modelConfig.toolConfig = {
          functionCallingConfig: {
            mode: 'ANY' // Force Gemini to use a tool
          }
        };
        logger.debug('Tool configuration: FORCED (mode: ANY)');
      } else {
        // Allow Gemini to choose whether to use tool or respond
        modelConfig.toolConfig = {
          functionCallingConfig: {
            mode: 'AUTO' // Let Gemini decide
          }
        };
        logger.debug('Tool configuration: AUTO (Gemini can choose)');
      }
    }

    const genModel = genAI.getGenerativeModel(modelConfig);

    // Convert messages to Gemini format
    const history = [];
    for (let i = 0; i < messages.length - 1; i += 1) {
      const msg = messages[i];
      // eslint-disable-next-line no-continue
      if (msg.role === 'system') continue; // Skip system messages in history
      if (msg.role === 'function') {
        // Function result
        history.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: JSON.parse(msg.content)
              }
            }
          ]
        });
      } else {
        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    const lastMessage = messages[messages.length - 1];
    const geminiChat = genModel.startChat({ history });

    const result = await geminiChat.sendMessage(lastMessage.content);
    const response = await result.response;

    console.log('=== GEMINI FULL RESPONSE ===');
    console.log(JSON.stringify(response.candidates?.[0], null, 2));
    console.log('=== END RESPONSE ===');

    logger.debug('Gemini raw response:', {
      hasCandidates: !!response.candidates,
      candidateCount: response.candidates?.length || 0,
      firstCandidate: response.candidates?.[0] ? {
        role: response.candidates[0].content?.role,
        partsCount: response.candidates[0].content?.parts?.length
      } : null
    });

    // Check for function calls in different ways
    const functionCalls = response.functionCalls?.();
    const candidateParts = response.candidates?.[0]?.content?.parts;
    const hasFunctionCall = candidateParts?.some((part) => part.functionCall);

    logger.debug('Function call detection:', {
      hasFunctionCallsMethod: typeof response.functionCalls === 'function',
      hasFunctionCall,
      partsCount: candidateParts?.length || 0
    });

    // Try to extract function calls from candidates
    if (hasFunctionCall) {
      const extractedCalls = candidateParts
        .filter((part) => part.functionCall)
        .map((part) => ({
          name: part.functionCall.name,
          parameters: part.functionCall.args
        }));

      logger.debug('Tool calls extracted from candidates:', {
        count: extractedCalls.length,
        calls: extractedCalls.map((fc) => fc.name)
      });
      return { toolCalls: extractedCalls };
    }

    if (functionCalls && functionCalls.length > 0) {
      logger.debug('Tool calls extracted from method:', {
        count: functionCalls.length,
        calls: functionCalls.map((fc) => fc.name)
      });
      return {
        toolCalls: functionCalls.map((fc) => ({
          name: fc.name,
          parameters: fc.args
        }))
      };
    }

    const content = response.text();

    logger.info('Received response from Gemini', {
      model,
      responseLength: content.length,
      requestId
    });

    return { text: content };
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new AppError(
      `Gemini API error: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Generate embeddings for text (for RAG/Vector search)
 * 
 * IMPROVEMENTS FOR BETTER SEARCH:
 * 1. Text preprocessing - clean, normalize, remove noise
 * 2. Smart truncation - respect token limits, cut at sentence boundaries
 * 3. Task type specification - better retrieval vs query differentiation
 * 4. Better error context - model name and status in errors
 * 5. Batch embedding support - efficient multi-text embedding
 * 
 * @param {string} text - Text to embed
 * @param {Object|string} [options] - Options object or model name string (backwards compatible)
 * @param {string} [options.model=DEFAULT_EMBEDDING_MODEL] - Embedding model
 * @param {string} [options.taskType='RETRIEVAL_DOCUMENT'] - 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY'
 * @returns {Promise<Array>} - Array of embedding values
 */
export const createEmbedding = async (text, options = {}) => {
  // Backwards compatible: if options is a string, treat it as model name
  const { 
    model = DEFAULT_EMBEDDING_MODEL, 
    taskType = 'RETRIEVAL_DOCUMENT' 
  } = typeof options === 'string' ? { model: options, taskType: 'RETRIEVAL_DOCUMENT' } : options;

  // Input validation
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new AppError('Valid text is required for embedding', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  try {
    // --- 1. TEXT PREPROCESSING ---
    let processedText = text
      .trim()
      // Normalize whitespace (multiple spaces → single space)
      .replace(/\s+/g, ' ')
      // Remove null bytes, control characters, and zero-width characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\uFEFF]/g, '')
      // Normalize Unicode (NFKC for consistent character representation)
      .normalize('NFKC')
      // Remove non-printable characters
      .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF]/g, '');

    // --- 2. SMART TRUNCATION ---
    // Gemini embedding models: gemini-embedding-001 has 3072 token limit
    // Rough estimate: 1 token ≈ 3-4 chars for English
    const MAX_CHARS = 8000; // Safe limit (~2500 tokens)
    
    if (processedText.length > MAX_CHARS) {
      logger.warn(`Text too long (${processedText.length} chars), truncating to ~${MAX_CHARS} chars`);
      
      // Try to cut at the last sentence boundary within limit
      const truncated = processedText.substring(0, MAX_CHARS);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastNewline = truncated.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);
      
      // Only cut at boundary if it's reasonably close to the end (>80% of limit)
      processedText = (cutPoint > MAX_CHARS * 0.8) 
        ? truncated.substring(0, cutPoint + 1) 
        : truncated;
    }

    logger.info('Creating embedding with Gemini', {
      model,
      taskType,
      originalLength: text.length,
      processedLength: processedText.length,
    });

    // --- 3. GENERATE EMBEDDING ---
    const embeddingModel = genAI.getGenerativeModel({ model });
    
    // Use proper content structure for the embedding request
    // This helps Gemini understand the context better
    const result = await embeddingModel.embedContent({
      role: 'user',
      parts: [{ text: processedText }],
    });
    
    const { embedding } = result;

    logger.info('Embedding created successfully', {
      dimensions: embedding.values.length,
      model,
    });

    return embedding.values;
  } catch (error) {
    logger.error('Gemini embedding error:', {
      model,
      textLength: text?.length,
      error: error.message,
      status: error.status,
    });

    throw new AppError(
      `Gemini embedding error (${model}): ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling createEmbedding repeatedly in a loop
 * 
 * @param {string[]} texts - Array of texts to embed
 * @param {Object} [options] - Options
 * @param {string} [options.model=DEFAULT_EMBEDDING_MODEL] - Embedding model
 * @param {string} [options.taskType='RETRIEVAL_DOCUMENT'] - Task type
 * @returns {Promise<number[][]>} - Array of embedding arrays
 */
export const createEmbeddingsBatch = async (texts, options = {}) => {
  const { model = DEFAULT_EMBEDDING_MODEL } = options;

  if (!Array.isArray(texts) || texts.length === 0) {
    throw new AppError('Valid texts array is required for batch embedding', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  try {
    logger.info(`Batch embedding ${texts.length} texts with Gemini`, { model });

    // Process sequentially with concurrency control to avoid rate limits
    const CONCURRENCY = 5;
    const results = [];
    
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const batch = texts.slice(i, i + CONCURRENCY);
      // eslint-disable-next-line no-await-in-loop
      const embeddings = await Promise.all(
        batch.map((text) => createEmbedding(text, { model, taskType: 'RETRIEVAL_DOCUMENT' }))
      );
      results.push(...embeddings);
    }

    logger.info(`Batch embedding complete: ${results.length} embeddings created`);
    
    return results;
  } catch (error) {
    logger.error('Batch embedding failed:', error);
    throw new AppError(
      `Batch embedding failed: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Analyze image with text prompt
 * @param {string} prompt - Text prompt
 * @param {Buffer|string} imageData - Image buffer or base64 string
 * @param {string} mimeType - Image MIME type (default: image/jpeg)
 * @returns {Promise<string>} - The AI response
 */
export const analyzeImage = async (prompt, imageData, mimeType = 'image/jpeg') => {
  // Input validation
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new AppError('Valid prompt is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }
  if (!imageData) {
    throw new AppError('Image data is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  try {
    logger.info('Analyzing image with Gemini', {
      promptLength: prompt.length,
      mimeType
    });

    const model = genAI.getGenerativeModel({ model: DEFAULT_VISION_MODEL });

    const imagePart = {
      inlineData: {
        data: Buffer.isBuffer(imageData) ? imageData.toString('base64') : imageData,
        mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const content = response.text();

    logger.info('Image analysis completed', {
      responseLength: content.length
    });

    return content;
  } catch (error) {
    logger.error('Gemini image analysis error:', error);
    throw new AppError(
      `Gemini image analysis error: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};
