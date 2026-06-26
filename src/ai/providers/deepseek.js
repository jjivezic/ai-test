import { ChatDeepSeek } from '@langchain/deepseek';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import logger from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';

const DEFAULT_CHAT_MODEL = 'deepseek-chat';
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.7;

// RAG chain
const ragPrompt = PromptTemplate.fromTemplate(`
You are a helpful assistant. Use the context below to answer.

Context:
{context}

Question: {question}

Answer based only on the context.
`);

export const ragQuery = async (question, contextChunks) => {
  const llm = new ChatDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: DEFAULT_CHAT_MODEL,
    temperature: 0.3,
    maxTokens: 1000,
  });

  const chain = RunnableSequence.from([ragPrompt, llm, new StringOutputParser()]);
  return chain.invoke({ context: contextChunks.join('\n\n'), question });
};

// --- CHAT ---

export const chat = async (prompt, options = {}, requestId = null) => {
  console.log('=== CHAT PROMPT ===', prompt);

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new AppError('Valid prompt is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE } = options;

  try {
    logger.info('Sending prompt to DeepSeek (LangChain)', { model, promptLength: prompt.length, requestId });

    const llm = new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      model,
      temperature,
      maxTokens,
    });

    const result = await llm.invoke(prompt);
    const content = typeof result.content === 'string' ? result.content : '';

    logger.info('Received response from DeepSeek', { model, responseLength: content.length, requestId });
    return content;
  } catch (error) {
    logger.error('DeepSeek API error:', error);
    throw new AppError(`DeepSeek API error: ${error.message}`, 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

// --- CHAT WITH HISTORY ---

export const chatWithHistory = async (messages, options = {}, requestId = null) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError('Valid messages array is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE, tools = null } = options;

  try {
    logger.info('Sending conversation to DeepSeek', { model, messageCount: messages.length, hasTools: !!tools, requestId });

    if (tools && tools.length > 0) {
      return await chatWithToolsRaw(messages, model, maxTokens, temperature, tools);
    }

    const llm = new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      model,
      temperature,
      maxTokens,
    });

    const lcMessages = messages.map((msg) => {
      if (msg.role === 'system') return { role: 'system', content: msg.content };
      if (msg.role === 'assistant') return { role: 'assistant', content: msg.content };
      return { role: 'user', content: msg.content };
    });

    const result = await llm.invoke(lcMessages);
    const content = typeof result.content === 'string' ? result.content : '';
    return { text: content };
  } catch (error) {
    logger.error('DeepSeek API error:', error);
    throw new AppError(`DeepSeek API error: ${error.message}`, 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

// Raw SDK for tool calling (DeepSeek is OpenAI-compatible)
async function chatWithToolsRaw(messages, model, maxTokens, temperature, tools) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
  });

  const response = await client.chat.completions.create({
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
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
  });

  const choice = response.choices[0];
  const toolCalls = choice.message.tool_calls;

  if (toolCalls?.length > 0) {
    return {
      toolCalls: toolCalls.map((tc) => ({ name: tc.function.name, parameters: JSON.parse(tc.function.arguments) })),
    };
  }

  return { text: choice.message.content || '' };
}
