import OpenAI from 'openai';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

const DEFAULT_CHAT_MODEL = 'gpt-3.5-turbo';
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_INSTRUCT_MODEL = 'gpt-3.5-turbo-instruct';
// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Send a simple chat completion request
 * @param {string} prompt - The user's prompt
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.model=DEFAULT_CHAT_MODEL] - Model to use
 * @param {number} [options.maxTokens=DEFAULT_MAX_TOKENS] - Maximum tokens in response (1-8000)
 * @param {number} [options.temperature=DEFAULT_TEMPERATURE] - Creativity level (0-2)
 * @param {string} [requestId=null] - Request ID for logging
 * @returns {Promise<string>} - The AI response text
 * @throws {AppError} If prompt is invalid or API request fails
 */
export const chat = async (prompt, options = {}, requestId = null) => {
  const {
    model = DEFAULT_CHAT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
  } = options;

  try {
    logger.info('Sending prompt to OpenAI', {
      model,
      promptLength: prompt.length,
      requestId,
    });

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
    });

    // Validate response
    if (!response || !response.choices || response.choices.length === 0) {
      throw new AppError(
        'Invalid response from OpenAI API',
        500,
        true,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    const { content } = response.choices[0].message;

    if (!content) {
      throw new AppError(
        'Empty content in OpenAI response',
        500,
        true,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    logger.info('Received response from OpenAI', {
      model,
      tokensUsed: response.usage?.total_tokens,
      responseLength: content.length,
      requestId,
    });

    return content;
  } catch (error) {
    logger.error('OpenAI chat failed', {
      error: error.message,
      model,
      promptLength: prompt.length,
      stack: error.stack,
      requestId,
    });

    throw new AppError(
      `Failed to generate chat response: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Send a chat completion with conversation history
 * @param {Array<Object>} messages - Array of message objects
 * @param {string} messages[].role - Message role (system, user, or assistant)
 * @param {string} messages[].content - Message content
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.model=DEFAULT_CHAT_MODEL] - Model to use
 * @param {number} [options.maxTokens=DEFAULT_MAX_TOKENS] - Maximum tokens in response (1-8000)
 * @param {number} [options.temperature=DEFAULT_TEMPERATURE] - Creativity level (0-2)
 * @param {string} [requestId=null] - Request ID for logging
 * @returns {Promise<string>} - The AI response text
 * @throws {AppError} If messages are invalid or API request fails
 */
export const chatWithHistory = async (messages, options = {}, requestId = null) => {
  const {
    model = DEFAULT_CHAT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
  } = options;

  try {
    logger.info('Sending conversation to OpenAI', {
      model,
      messageCount: messages.length,
      requestId,
    });

    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    const { content } = response.choices[0].message;

    logger.info('Received response from OpenAI', {
      model,
      tokensUsed: response.usage.total_tokens,
      requestId,
    });

    return content;
  } catch (error) {
    logger.error('OpenAI chat with history failed', {
      error: error.message,
      model,
      messageCount: messages.length,
      stack: error.stack,
      requestId,
    });

    throw new AppError(
      `Failed to generate chat with history: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Generate text completion (for simpler use cases)
 * @param {string} prompt - The prompt
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.model=DEFAULT_INSTRUCT_MODEL] - Model to use
 * @param {number} [options.maxTokens=DEFAULT_MAX_TOKENS] - Maximum tokens in response (1-8000)
 * @param {number} [options.temperature=DEFAULT_TEMPERATURE] - Creativity level (0-2)
 * @param {string} [requestId=null] - Request ID for logging
 * @returns {Promise<string>} - The AI response text
 * @throws {AppError} If prompt is invalid or API request fails
 */
export const complete = async (prompt, options = {}, requestId = null) => {
  const {
    model = DEFAULT_INSTRUCT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
  } = options;

  try {
    logger.info('Sending completion request to OpenAI', {
      model,
      promptLength: prompt.length,
      requestId,
    });

    const response = await openai.completions.create({
      model,
      prompt,
      max_tokens: maxTokens,
      temperature,
    });

    const content = response.choices[0].text;

    logger.info('Received completion from OpenAI', {
      model,
      tokensUsed: response.usage.total_tokens,
      requestId,
    });

    return content;
  } catch (error) {
    logger.error('OpenAI completion failed', {
      error: error.message,
      model,
      promptLength: prompt.length,
      stack: error.stack,
      requestId,
    });

    throw new AppError(
      `Failed to generate completion: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};
