import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import logger from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';

const DEFAULT_CHAT_MODEL = 'gpt-4';
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.7;

// RAG chain with LangChain
const ragPrompt = PromptTemplate.fromTemplate(`
You are a helpful assistant. Use the context below to answer.

Context:
{context}

Question: {question}

Answer based only on the context.
`);

export const ragQuery = async (question, contextChunks) => {
  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: DEFAULT_CHAT_MODEL,
    temperature: 0.3,
    maxTokens: 1000,
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
    logger.info('Sending prompt to OpenAI (LangChain)', {
      model,
      promptLength: prompt.length,
      requestId,
    });

    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model,
      temperature,
      maxTokens,
    });

    const result = await llm.invoke(prompt);
    const content = typeof result.content === 'string' ? result.content : '';

    logger.info('Received response from OpenAI', {
      model,
      responseLength: content.length,
      requestId,
    });

    return content;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new AppError(`OpenAI API error: ${error.message}`, 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

// --- CHAT WITH HISTORY ---
// Uses LangChain for simple chats, raw SDK for tool calls

export const chatWithHistory = async (messages, options = {}, requestId = null) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError('Valid messages array is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE, tools = null } = options;

  try {
    logger.info('Sending conversation to OpenAI', {
      model,
      messageCount: messages.length,
      hasTools: !!tools,
      requestId,
    });

    // If tools are provided, use raw SDK (better tool support for agents)
    if (tools && tools.length > 0) {
      return await chatWithToolsRaw(messages, model, maxTokens, temperature, tools);
    }

    // No tools — use LangChain
    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model,
      temperature,
      maxTokens,
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
    logger.error('OpenAI API error:', error);
    throw new AppError(`OpenAI API error: ${error.message}`, 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

// Raw SDK version for tool calling
async function chatWithToolsRaw(messages, model, maxTokens, temperature, tools) {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role === 'function' ? 'tool' : m.role,
      content: m.content,
      ...(m.role === 'function' ? { tool_call_id: m.name } : {}),
    })),
    max_tokens: maxTokens,
    temperature,
    tools: tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
    tool_choice: 'auto',
  });

  const choice = response.choices[0];
  const toolCalls = choice.message.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    return {
      toolCalls: toolCalls.map((tc) => ({
        name: tc.function.name,
        parameters: JSON.parse(tc.function.arguments),
      })),
    };
  }

  return { text: choice.message.content || '' };
}

// --- Embeddings ---

export const createEmbedding = async (text, options = {}) => {
  const { model = 'text-embedding-3-small' } = typeof options === 'string' ? { model: options } : options;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new AppError('Valid text is required for embedding', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const result = await openai.embeddings.create({
    model,
    input: text,
  });

  return result.data[0].embedding;
};

export const createEmbeddingsBatch = async (texts, options = {}) => {
  const { model = 'text-embedding-3-small' } = options;
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new AppError('Valid texts array is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const result = await openai.embeddings.create({
    model,
    input: texts,
  });

  return result.data.map((d) => d.embedding);
};
