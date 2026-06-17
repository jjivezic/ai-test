import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

// Configuration constants
const DEFAULT_CHAT_MODEL = 'gemini-2.0-flash-exp';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';
const DEFAULT_VISION_MODEL = 'gemini-pro-vision';
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
 * @param {string} text - Text to embed
 * @param {string} [model=DEFAULT_EMBEDDING_MODEL] - Embedding model (default: text-embedding-004)
 * @returns {Promise<Array>} - Array of embedding values
 */
export const createEmbedding = async (text, model = DEFAULT_EMBEDDING_MODEL) => {
  // Input validation
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new AppError('Valid text is required for embedding', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  try {
    logger.info('Creating embedding with Gemini', {
      model,
      textLength: text.length
    });

    const embeddingModel = genAI.getGenerativeModel({ model });
    const result = await embeddingModel.embedContent(text);
    const { embedding } = result;

    logger.info('Embedding created', {
      dimensions: embedding.values.length
    });

    return embedding.values;
  } catch (error) {
    logger.error('Gemini embedding error:', error);
    throw new AppError(
      `Gemini embedding error: ${error.message}`,
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
