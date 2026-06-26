import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { search as vectorSearch, getStats as vectorGetStats } from '../vector/service.js';
import { chat } from './factory.js';
import emailService from '../integration/email/service.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

/**
 * LangChain Agent — Dynamically supports Gemini or OpenAI
 * Controlled by AI_PROVIDER env var
 */

// --- Get the right LLM based on provider ---

function getLLM() {
  const provider = process.env.AI_PROVIDER || 'gemini';

  if (provider === 'openai') {
    return new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
    });
  }

  // Default: Gemini
  return new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    temperature: 0.7,
    maxOutputTokens: 1000,
  });
}

// --- Define LangChain Structured Tools ---

const searchTool = new DynamicStructuredTool({
  name: 'searchDocuments',
  description: 'Search for documents in the knowledge base. Use query for semantic search, keyword for exact text matching.',
  schema: z.object({
    query: z.string().describe('The semantic search query - describe what you are looking for'),
    keyword: z.string().optional().describe('Exact text to find in documents (case-insensitive)'),
    nResults: z.number().optional().default(10).describe('Number of results to return'),
  }),
  func: async ({ query, keyword, nResults }) => {
    logger.info('Agent: searchDocuments', { query, keyword });

    const results = await vectorSearch(query, nResults || 10, keyword || null, 1.5);

    return JSON.stringify({
      success: true,
      count: results.length,
      results: results.map((r) => ({
        googleLink: r.googleLink,
        fileName: r.metadata.name,
        folderPath: r.metadata.folderPath || process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME,
        path: r.path,
        distance: r.distance?.toFixed(3),
      })),
    });
  },
});

const emailTool = new DynamicStructuredTool({
  name: 'sendEmail',
  description: 'Send an email to a recipient.',
  schema: z.object({
    to: z.string().describe('Recipient email address'),
    recipientName: z.string().optional().describe('Recipient first name'),
    subject: z.string().describe('Email subject line'),
    message: z.string().describe('Email message body - professional and polite'),
  }),
  func: async ({ to, subject, message }) => {
    logger.info('Agent: sendEmail', { to, subject });

    await emailService.sendAiEmail({ to, subject, html: message });
    return JSON.stringify({ success: true, message: `Email sent to ${to}` });
  },
});

const statsTool = new DynamicStructuredTool({
  name: 'getDocumentStats',
  description: 'Get statistics about the document knowledge base.',
  schema: z.object({}),
  func: async () => {
    logger.info('Agent: getDocumentStats');
    const stats = await vectorGetStats();
    return JSON.stringify({ success: true, stats });
  },
});

const summarizeTool = new DynamicStructuredTool({
  name: 'summarizeDocument',
  description: 'Generate a summary of a specific document.',
  schema: z.object({
    documentName: z.string().describe('Name or part of the name of the document to summarize'),
    query: z.string().describe('Search query to help find the document'),
    maxLength: z.number().optional().default(200).describe('Maximum summary length in words'),
  }),
  func: async ({ documentName, query, maxLength }) => {
    logger.info('Agent: summarizeDocument', { documentName });

    const nameWithoutExt = documentName.replace(/\.(pdf|docx?|xlsx?|txt|pptx?)$/i, '');

    let searchResults = await vectorSearch(query || nameWithoutExt, 5, null, null, {
      name: documentName,
    });

    if (!searchResults?.length) {
      searchResults = await vectorSearch(nameWithoutExt, 5, nameWithoutExt, null);
    }

    if (!searchResults?.length) {
      return JSON.stringify({ success: false, message: `Document "${documentName}" not found.` });
    }

    const doc = searchResults[0];
    if (!doc.text) {
      return JSON.stringify({ success: false, message: `No text in "${doc.metadata.name}".` });
    }

    const summary = await chat(
      `Summarize this document in max ${maxLength || 200} words:\n\n${doc.text}`
    );

    return JSON.stringify({
      success: true,
      documentName: doc.metadata.name,
      folderPath: doc.metadata.folderPath || process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME,
      googleLink: doc.googleLink,
      summary,
    });
  },
});

const tools = [searchTool, emailTool, statsTool, summarizeTool];

// --- Agent System Prompt ---

const systemPrompt = `You are an AI agent that searches INTERNAL documents from ChromaDB database.

CRITICAL RULES:
1. You HAVE access to documents in ChromaDB!
2. ALWAYS use tools to access documents
3. NEVER say "I don't have access", "I can't open" - THAT'S A LIE!

TOOLS:
- searchDocuments: Search documents in database
- summarizeDocument: Summarize a specific document
- sendEmail: Send email
- getDocumentStats: Database statistics

IMPORTANT: Respond in the SAME LANGUAGE as the user's question (English, Serbian, etc.)`;

// --- Exported executeTask ---

export const executeTask = async (userPrompt, maxIterations = 5) => {
  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
    throw new AppError('Valid prompt is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  const provider = process.env.AI_PROVIDER || 'gemini';
  logger.info('Agent starting task (LangChain)', {
    provider,
    promptLength: userPrompt.length,
    maxIterations,
  });

  const llm = getLLM();

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: systemPrompt,
  });

  try {
    const result = await agent.invoke(
      { messages: [new HumanMessage(userPrompt)] },
      { recursionLimit: maxIterations }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const answer = typeof lastMessage.content === 'string' ? lastMessage.content : '';

    // Format search results with links
    let finalAnswer = answer;
    const searchResults = result.messages
      .filter((m) => m._getType() === 'tool' && m.name === 'searchDocuments')
      .map((m) => {
        try {
          return JSON.parse(m.content);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .pop();

    if (searchResults?.results?.length > 0) {
      finalAnswer += '\n\n';
      searchResults.results.forEach((r, i) => {
        finalAnswer += `\n${i + 1}. 📂 ${r.folderPath}\n   📄 ${r.fileName}`;
        if (r.googleLink) {
          finalAnswer += `\n   🔗 <a href="${r.googleLink}" target="_blank">Open</a>`;
        }
        finalAnswer += '\n';
      });
    }

    return { success: true, answer: finalAnswer, iterations: result.messages.length };
  } catch (error) {
    logger.error('Agent failed:', error.message);

    if (error.message?.includes('recursion') || error.message?.includes('max iterations')) {
      return {
        success: true,
        answer: 'Task requires too many steps. Here is what I found so far.',
        iterations: maxIterations,
      };
    }

    throw new AppError(`Agent error: ${error.message}`, 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};
