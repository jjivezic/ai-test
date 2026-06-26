import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import logger from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';

const DEFAULT_CHAT_MODEL = 'gemini-2.0-flash';
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const DEFAULT_VISION_MODEL = 'gemini-2.0-flash';
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.7;

// Keep raw SDK for embedding & vision
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// RAG chain with LangChain
const ragPrompt = PromptTemplate.fromTemplate(`
You are a helpful assistant. Use the context below to answer.

Context:
{context}

Question: {question}

Answer based only on the context.
`);

export const ragQuery = async (question, contextChunks) => {
  const llm = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: DEFAULT_CHAT_MODEL,
    temperature: 0.3,
    maxOutputTokens: 1000,
  });

  const chain = RunnableSequence.from([
    ragPrompt,
    llm,
    new StringOutputParser(),
  ]);

  return chain.invoke({
    context: contextChunks.join('\n\n'),
    question,
  });
};

// --- CHAT with LangChain ---

export const chat = async (prompt, options = {}, requestId = null) => {
  console.log('=== CHAT PROMPT ===', prompt);

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new AppError('Valid prompt is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE } = options;

  try {
    logger.info('Sending prompt to Gemini (LangChain)', {
      model,
      promptLength: prompt.length,
      requestId,
    });

    const llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model,
      temperature,
      maxOutputTokens: maxTokens,
    });

    const result = await llm.invoke(prompt);
    const content = typeof result.content === 'string' ? result.content : '';

    logger.info('Received response from Gemini', {
      model,
      responseLength: content.length,
      requestId,
    });

    return content;
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new AppError(`Gemini API error: ${error.message}`, 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

// --- CHAT WITH HISTORY ---
// Uses LangChain for simple chats, raw SDK for tool calls

export const chatWithHistory = async (messages, options = {}, requestId = null) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError('Valid messages array is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE, tools = null, forceToolUse = true } = options;

  try {
    logger.info('Sending conversation to Gemini', {
      model,
      messageCount: messages.length,
      hasTools: !!tools,
      requestId,
    });

    // If tools are provided, use raw SDK (LangChain tool handling with Gemini is immature)
    if (tools && tools.length > 0) {
      return await chatWithToolsRaw(messages, model, maxTokens, temperature, tools, forceToolUse);
    }

    // No tools — use LangChain
    const llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model,
      temperature,
      maxOutputTokens: maxTokens,
    });

    // Convert messages to LangChain format
    const lcMessages = messages.map((msg) => {
      if (msg.role === 'system') return { role: 'system', content: msg.content };
      if (msg.role === 'assistant') return { role: 'assistant', content: msg.content };
      return { role: 'user', content: msg.content };
    });

    const result = await llm.invoke(lcMessages);
    const content = typeof result.content === 'string' ? result.content : '';

    return { text: content };
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new AppError(`Gemini API error: ${error.message}`, 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

// Raw SDK version for tool calling (kept from your original)
async function chatWithToolsRaw(messages, model, maxTokens, temperature, tools, forceToolUse) {
  const modelConfig = {
    model,
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  };

  if (tools && tools.length > 0) {
    modelConfig.tools = [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];
    modelConfig.toolConfig = {
      functionCallingConfig: { mode: forceToolUse ? 'ANY' : 'AUTO' },
    };
  }

  const genModel = genAI.getGenerativeModel(modelConfig);

  const history = [];
  for (let i = 0; i < messages.length - 1; i += 1) {
    const msg = messages[i];
    if (msg.role === 'system') continue;
    if (msg.role === 'function') {
      history.push({
        role: 'function',
        parts: [{ functionResponse: { name: msg.name, response: JSON.parse(msg.content) } }],
      });
    } else {
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  const lastMessage = messages[messages.length - 1];
  const geminiChat = genModel.startChat({ history });
  const result = await geminiChat.sendMessage(lastMessage.content);
  const response = await result.response;

  const functionCalls = response.functionCalls?.();
  const candidateParts = response.candidates?.[0]?.content?.parts;
  const hasFunctionCall = candidateParts?.some((part) => part.functionCall);

  if (hasFunctionCall) {
    const extractedCalls = candidateParts
      .filter((part) => part.functionCall)
      .map((part) => ({ name: part.functionCall.name, parameters: part.functionCall.args }));
    return { toolCalls: extractedCalls };
  }

  if (functionCalls && functionCalls.length > 0) {
    return {
      toolCalls: functionCalls.map((fc) => ({ name: fc.name, parameters: fc.args })),
    };
  }

  return { text: response.text() };
}

// --- Embeddings (keep raw SDK) ---

export const createEmbedding = async (text, options = {}) => {
  const { model = DEFAULT_EMBEDDING_MODEL, taskType = 'RETRIEVAL_DOCUMENT' } =
    typeof options === 'string' ? { model: options, taskType: 'RETRIEVAL_DOCUMENT' } : options;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new AppError('Valid text is required for embedding', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  try {
    let processedText = text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\uFEFF]/g, '')
      .normalize('NFKC')
      .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF]/g, '');

    const MAX_CHARS = 8000;
    if (processedText.length > MAX_CHARS) {
      logger.warn(`Text too long (${processedText.length} chars), truncating`);
      const truncated = processedText.substring(0, MAX_CHARS);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastNewline = truncated.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);
      processedText = cutPoint > MAX_CHARS * 0.8 ? truncated.substring(0, cutPoint + 1) : truncated;
    }

    const embeddingModel = genAI.getGenerativeModel({ model });
    const request = { content: { parts: [{ text: processedText }] }, taskType, outputDimensionality: 768 };
    const result = await embeddingModel.embedContent(request);
    return result.embedding.values;
  } catch (error) {
    logger.error('Gemini embedding error:', { model, textLength: text?.length, error: error.message });
    throw new AppError(`Gemini embedding error (${model}): ${error.message}`, 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

export const createEmbeddingsBatch = async (texts, options = {}) => {
  const { model = DEFAULT_EMBEDDING_MODEL } = options;
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new AppError('Valid texts array is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const CONCURRENCY = 5;
  const results = [];
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const batch = texts.slice(i, i + CONCURRENCY);
    const embeddings = await Promise.all(
      batch.map((text) => createEmbedding(text, { model, taskType: 'RETRIEVAL_DOCUMENT' }))
    );
    results.push(...embeddings);
  }
  return results;
};

export const analyzeImage = async (prompt, imageData, mimeType = 'image/jpeg') => {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new AppError('Valid prompt is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }
  if (!imageData) {
    throw new AppError('Image data is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const model = genAI.getGenerativeModel({ model: DEFAULT_VISION_MODEL });
  const imagePart = {
    inlineData: {
      data: Buffer.isBuffer(imageData) ? imageData.toString('base64') : imageData,
      mimeType,
    },
  };
  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  return response.text();
};
