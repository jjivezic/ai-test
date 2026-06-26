import * as geminiService from './providers/gemini.js';
import * as openaiService from './providers/openai.js';
import logger from '../config/logger.js';

/**
 * AI Provider Factory
 * Switches between Gemini and OpenAI based on AI_PROVIDER env var
 * 
 * Usage: AI_PROVIDER=gemini (default) or AI_PROVIDER=openai
 */

const PROVIDER = process.env.AI_PROVIDER || 'gemini';

const providers = {
  gemini: {
    chat: geminiService.chat,
    chatWithHistory: geminiService.chatWithHistory,
    ragQuery: geminiService.ragQuery,
    createEmbedding: geminiService.createEmbedding,
    createEmbeddingsBatch: geminiService.createEmbeddingsBatch,
    analyzeImage: geminiService.analyzeImage,
  },
  openai: {
    chat: openaiService.chat,
    chatWithHistory: openaiService.chatWithHistory,
    ragQuery: openaiService.ragQuery,
    createEmbedding: openaiService.createEmbedding,
    createEmbeddingsBatch: openaiService.createEmbeddingsBatch,
    // OpenAI doesn't have analyzeImage — will fallback
  },
};

const active = providers[PROVIDER];

if (!active) {
  logger.error(`Unknown AI provider: "${PROVIDER}". Using Gemini as fallback.`);
}

const fallback = providers.gemini;

export const chat = active?.chat || fallback.chat;
export const chatWithHistory = active?.chatWithHistory || fallback.chatWithHistory;
export const ragQuery = active?.ragQuery || fallback.ragQuery;
export const createEmbedding = active?.createEmbedding || fallback.createEmbedding;
export const createEmbeddingsBatch = active?.createEmbeddingsBatch || fallback.createEmbeddingsBatch;
export const analyzeImage = active?.analyzeImage || fallback.analyzeImage;
