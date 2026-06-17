import { chatWithHistory, chat } from './geminiService.js';
import { search as vectorSearch, getStats as vectorGetStats } from './vectorService.js';
import emailService from './emailService.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

/**
 * AI Agent Service
 * Autonomous agent that can use tools to complete tasks
 */

/**
 * Define available tools for the agent
 */
const defineTools = () => {
  return [
    {
      name: 'searchDocuments',
      description: 'Search for documents in the knowledge base. Use keyword parameter for exact text matching, and query for semantic search.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The semantic search query - describe what you are looking for'
          },
          keyword: {
            type: 'string',
            description:
              'Exact text to find in documents (case-insensitive). Use this when user asks for specific text like "xyz" or "contract expired"'
          },
          nResults: {
            type: 'number',
            description: 'Number of results to return (default: 10)'
          }
        },
        required: ['query']
      },
      function: async (params) => {
        console.log('=== SEARCH PARAMS ===');
        console.log('Query:', params.query);
        console.log('Keyword:', params.keyword);
        console.log('nResults:', params.nResults);
        console.log('=== END PARAMS ===');
        
        const results = await vectorSearch(
          params.query,
          params.nResults || 10,
          params.keyword || null,
          1.5 // Distance filter - only return results with distance < 1.5 (higher quality matches)
        );
        
        logger.info(`Found ${results.length} documents`);
        return {
          success: true,
          count: results.length,
          results: results.map((r) => ({
            googleLink: r.googleLink, // PUT FIRST!
            fileName: r.metadata.name,
            folderPath: r.metadata.folderPath || process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME,
            path: r.path,
            // textPreview: r.text.substring(0, 200) + '...', // Shortened text
            distance: r.distance.toFixed(3)
          }))
        };
      }
    },
    {
      name: 'sendEmail',
      description: 'Send an email to a recipient. Use this when user asks to send information via email. Extract recipient name if mentioned. Write a professional, well-formatted message.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address'
          },
          recipientName: {
            type: 'string',
            description: 'Recipient first name (e.g., "Jelena", "John"). Extract from context if user mentions it.'
          },
          subject: {
            type: 'string',
            description: 'Email subject line - make it clear and professional'
          },
          message: {
            type: 'string',
            description: 'Email message body - write a professional, polite, well-formatted message. If recipent and sender are unknow add general greetings like "Hello" and sign with "Best regards".'
          }
        },
        required: ['to', 'subject', 'message']
      },
      function: async (params) => {
        logger.info('Agent calling sendEmail:', { to: params.to, subject: params.subject });
        

        
        await emailService.sendAiEmail({
          to: params.to,
          subject: params.subject,
          html:  params.message
        });
        return {
          success: true,
          message: `Email sent to ${params.to}`,
          sentEmail: {
            to: params.to,
            recipientName: params.recipientName,
            subject: params.subject,
            body: params.message
          }
        };
      }
    },
    {
      name: 'getDocumentStats',
      description: 'Get statistics about the document knowledge base',
      parameters: {
        type: 'object',
        properties: {}
      },
      function: async () => {
        logger.info('Agent calling getDocumentStats');
        const stats = await vectorGetStats();
        return {
          success: true,
          stats
        };
      }
    },
    {
      name: 'summarizeDocument',
      description:
        'Generate a summary of a specific document. Use when user asks to summarize a document or get document overview.',
      parameters: {
        type: 'object',
        properties: {
          documentName: {
            type: 'string',
            description: 'Name or part of the name of the document to summarize (e.g., "OPENAI VS CLAUDE")'
          },
          maxLength: {
            type: 'number',
            description: 'Maximum length of summary in words (default: 200)'
          },
          query: {
            type: 'string',
            description: 'The semantic search query - describe what you are looking for'
          },
        },
        required: ['documentName', 'query']
      },
      function: async (params) => {
        logger.info('Agent calling summarizeDocument&&&&&&1111111111111111111:', params?.query );

        // Remove file extension for better matching
        const documentNameWithoutExt = params.documentName.replace(/\.(pdf|docx?|xlsx?|txt|pptx?)$/i, '');
        
        // Try exact match first using metadata filter
        let searchResults = await vectorSearch(
          documentNameWithoutExt,
          5,
          null, // No keyword filter
          null, // No distance filter
          { name: params.documentName } // Exact metadata match
        );

        console.log('=== SEARCH WITH EXACT NAME FILTER ===');
        console.log('Looking for name:', params.documentName);
        console.log('Results:', searchResults?.length || 0);
        console.log('=== END EXACT SEARCH ===');

        // If no exact match, try partial match with keyword
        if (!searchResults || searchResults.length === 0) {
          logger.debug('No exact match, trying partial match');
          searchResults = await vectorSearch(
            documentNameWithoutExt,
            5,
            documentNameWithoutExt, // Use as keyword
            null
          );
          
          console.log('=== SEARCH WITH PARTIAL MATCH ===');
          console.log('Keyword:', documentNameWithoutExt);
          console.log('Results:', searchResults?.length || 0);
          if (searchResults?.length > 0) {
            console.log('Found:', searchResults.map(r => r.metadata.name));
          }
          console.log('=== END PARTIAL SEARCH ===');
        }

        if (!searchResults || searchResults.length === 0) {
          logger.warn('No document found with name:', params.documentName);
          return {
            success: false,
            message: `Nisam pronašao dokument sa nazivom "${params.documentName}" u bazi.`
          };
        }

        // Get the best match (first result after sorting)
        const document = searchResults[0];
        logger.info('Document found for summarization:', {
          fileName: document.metadata.name,
          textLength: document.text?.length || 0
        });

        // Get full text from the document
        const fullText = document.text || '';

        if (fullText.length === 0) {
          logger.warn('Document has no text content:', document.metadata.name);
          return {
            success: false,
            message: `No text content found in document "${document.metadata.name}".`
          };
        }

        // Generate summary using Gemini - it will respond in the same language as the user's question
        const maxLength = params.maxLength || 200;
        const summaryPrompt = `Create a summary of the following document in maximum ${maxLength} words. Focus on the main topics and key information.\n\nDocument:\n${fullText}`;

        logger.debug('Generating summary with Gemini:', { textLength: fullText.length, maxLength });
        const summary = await chat(summaryPrompt);

        logger.info('Summary generated:', { summaryLength: summary.length });

        return {
          success: true,
          documentName: document.metadata.name,
          folderPath: document.metadata.folderPath || process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME,
          googleLink: document.googleLink,
          extension: document.metadata.extension,
          summary,
          originalLength: fullText.length,
          summaryLength: summary.split(/\s+/).length // Word count
        };
      }
    }
  ];
};

// Initialize tools once
const tools = defineTools();

/**
 * Execute agent task with autonomous tool usage
 * @param {string} userPrompt - User's request
 * @param {number} maxIterations - Maximum tool calls to prevent infinite loops
 */
export const executeTask = async (userPrompt, maxIterations = 5) => {
  // Input validation
  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
    throw new AppError('Valid prompt is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  logger.info('Agent starting task:', { promptLength: userPrompt.length, maxIterations });

  const conversationHistory = [
    {
      role: 'system',
      content: `You are an AI agent that searches INTERNAL documents from ChromaDB database.

CRITICAL RULES:
1. You HAVE access to documents in ChromaDB!
2. ALWAYS use tools to access documents
3. NEVER say "I don't have access", "I can't open", "I don't understand" - THAT'S A LIE!
4. Documents are ALREADY IN DATABASE - use tools and respond with results

TOOLS:
- searchDocuments: Search documents in database
- summarizeDocument: Summarize a specific document
- sendEmail: Send email
- getDocumentStats: Database statistics

IMPORTANT WORKFLOW:
Respond in the same language as the user's question

NEVER say "I don't understand" or "repeat" after getting tool results!
If tool returns results, you MUST respond with those results!

LANGUAGE: Respond in the same language as the user's question (English, Serbian, etc.)

If tool returns empty: "I didn't find any documents in the database."
If tool returns results: "I found [number] documents: [list]"`
    },
    {
      role: 'user',
      content: userPrompt
    }
  ];

  const toolCalls = [];
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations += 1;
    logger.debug(`Agent iteration ${iterations}/${maxIterations}`);

    // After first tool call, allow Gemini to respond without forcing tools
    const forceTools = toolCalls.length === 0; // Force tools on first iteration only

    // Ask Gemini what to do next
    const response = await chatWithHistory(conversationHistory, {
      temperature: 0.7,
      maxTokens: 1000,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      })),
      forceToolUse: forceTools // Pass flag to force tool usage on first iteration
    });
    console.log('=== GEMINI RESPONSExxxxxxxxxxxxx ===',response);
    logger.debug('Gemini response received:', {
      hasToolCalls: !!response.toolCalls,
      hasText: !!response.text
    });

    // Check if agent wants to use a tool
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('=== TOOLS REQUESTED BY GEMINI ===');
      console.log('Tool names:', response.toolCalls.map((tc) => tc.name));
      console.log('Tool parameters:', JSON.stringify(response.toolCalls, null, 2));
      console.log('=== END TOOL REQUEST ===');
      
      logger.info(
        `Agent requested ${response.toolCalls.length} tool calls:`,
        response.toolCalls.map((tc) => tc.name)
      );

      // Execute tool calls
      // Filter out unknown tools and log warnings
      const validToolCalls = response.toolCalls.filter((toolCall) => {
        const tool = tools.find((t) => t.name === toolCall.name);
        if (!tool) {
          logger.warn('Unknown tool requested:', toolCall.name);
          return false;
        }
        return true;
      });

      // Execute tools sequentially to avoid race conditions
      // eslint-disable-next-line no-restricted-syntax
      for (const toolCall of validToolCalls) {
        const tool = tools.find((t) => t.name === toolCall.name);

        console.log('=== EXECUTING TOOL ===');
        console.log('Tool name:', toolCall.name);
        console.log('Parameters:', JSON.stringify(toolCall.parameters, null, 2));
        console.log('=== START EXECUTION ===');

        logger.debug('Executing tool:', toolCall.name, JSON.stringify(toolCall.parameters));

        try {
          const result = await tool.function(toolCall.parameters);

          toolCalls.push({
            tool: toolCall.name,
            parameters: toolCall.parameters,
            result
          });

          console.log('=== TOOL RESULT BEING SENT TO GEMINI ===',toolCall);
          console.log(JSON.stringify(result, null, 2));
          console.log('=== END TOOL RESULT ===');

          logger.debug(`Tool ${toolCall.name} result:`, JSON.stringify(result).substring(0, 200));

          // Add instruction for Gemini based on tool type
          let instruction = '';
          if (toolCall.name === 'searchDocuments' && result.count > 0) {
            instruction = `\n\nYou found ${result.count} document${result.count === 1 ? '' : 's'}. Present results in user's language. DO NOT call searchDocuments again.`;
          } else if (toolCall.name === 'searchDocuments' && result.count === 0) {
            instruction = '\n\nNo documents found. Tell user in their language. DO NOT call tools again.';
          } else if (toolCall.name === 'summarizeDocument' && result.success) {
            instruction = "\n\nDocument summarized. Present in user's language. DO NOT call tools again.";
          } else if (toolCall.name === 'sendEmail' && result.success) {
            instruction = '\n\nEmail sent successfully. Confirm to user in their language. DO NOT call sendEmail again.';
          }

          // Add tool result to conversation with instruction
          conversationHistory.push({
            role: 'function',
            name: toolCall.name,
            content: JSON.stringify(result) + instruction
          });
        } catch (error) {
          logger.error(`Tool ${toolCall.name} failed:`, error);
          conversationHistory.push({
            role: 'function',
            name: toolCall.name,
            content: JSON.stringify({ error: error.message })
          });
        }
      }

      // Continue loop to get agent's response after using tools
      // eslint-disable-next-line
      continue;
    }

    // Agent has text response
    if (response.text) {
      logger.info('Agent completed task successfully', {
        answerLength: response.text.length,
        toolCallsUsed: toolCalls.length,
        iterations
      });
      
      // Extract googleLinks from search results (if any)
      const searchResults = toolCalls
        .filter((tc) => tc.tool === 'searchDocuments')
        .flatMap((tc) => tc.result?.results || []);

      // Extract sent emails (if any)
      const sentEmails = toolCalls
        .filter((tc) => tc.tool === 'sendEmail')
        .flatMap((tc) => tc.result?.sentEmail ? [tc.result.sentEmail] : []);

      // Extract summaries (if any)
      const summaries = toolCalls
        .filter((tc) => tc.tool === 'summarizeDocument')
        .flatMap((tc) => tc.result?.success ? [tc.result] : []);

      let finalAnswer = '';

      // Format results with simple universal labels
      if (searchResults.length > 0) {
        // Use Gemini's text response which will be in user's language
        finalAnswer = response.text + '\n\n';
        console.log('=== FORMATTING SEARCH RESULTS ===',finalAnswer);
        searchResults.forEach((result, index) => {
          const extension = result.path ? result.path.split('.').pop() : '';
          const fileNameWithExt = extension ? `${result.fileName}.${extension}` : result.fileName;
           finalAnswer += '\n *************************** \n';
          finalAnswer += `${index + 1}. 📂 **${result.folderPath}**\n`;
          finalAnswer += `   📄 ${fileNameWithExt}\n`;
          if (result.googleLink) {
            finalAnswer += `   🔗 <a href="${result.googleLink}" target="_blank" rel="noopener noreferrer">Open</a>\n`;
          }
          finalAnswer += '\n';
        });
      } else if (summaries.length > 0) {
        // Use Gemini's text response which contains the translated summary in user's language
        finalAnswer = response.text + '\n\n';
        summaries.forEach((summary) => {
          const extension = summary.extension || 'doc';
          const fileNameWithExt = `${summary.documentName}${extension}`;
          
          finalAnswer += `📝 **${fileNameWithExt}**\n`;
          finalAnswer += `📂 ${summary.folderPath}\n`;
          if (summary.googleLink) {
            finalAnswer += `🔗 <a href="${summary.googleLink}" target="_blank" rel="noopener noreferrer">Open document</a>\n`;
          }
          finalAnswer += '\n';
        });
      } else if (sentEmails.length > 0) {
        // Use Gemini's text which will be in user's language
        finalAnswer = response.text + '\n\n';
        sentEmails.forEach((email) => {
          finalAnswer += `📧 ${email.to}\n`;
          finalAnswer += `📋 ${email.subject}\n`;
          finalAnswer += `📝 ${email.body}\n`;
        });
      } else {
        // No special formatting - use Gemini's text response
        finalAnswer = response.text;
      }

      return {
        success: true,
        answer: finalAnswer,
        toolCalls,
        iterations
      };
    }

    // No tools and no text - unexpected, break loop
    logger.warn('Agent returned neither tools nor text');
    throw new AppError(
      'Agent did not provide a response',
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }

  // Max iterations reached
  logger.warn('Agent reached max iterations');
  throw new AppError(
    'Task too complex, reached maximum tool usage limit',
    400,
    true,
    ERROR_CODES.BAD_REQUEST
  );
};
