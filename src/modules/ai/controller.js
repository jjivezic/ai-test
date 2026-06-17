import { chat as openaiChat, chatWithHistory as openaiChatWithHistory } from '../../services/openaiService.js';
import { chat as geminiChat, chatWithHistory as geminiChatWithHistory } from '../../services/geminiService.js';
import logger from '../../config/logger.js';
import { catchAsync, AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';

export const AIchat = catchAsync(async (req, res) => {
  const { prompt, provider = 'gemini', model, maxTokens = 500, temperature = 0.7 } = req.body;

  logger.info('Processing AI chat request', {
    promptLength: prompt.length,
    provider,
    model
  });

  let response;
  let usedModel;

  if (provider === 'gemini') {
    usedModel = model || 'gemini-2.0-flash-exp';
    response = await geminiChat(
      prompt,
      {
        model: usedModel,
        maxTokens,
        temperature
      },
      req.id
    );
  } else if (provider === 'openai') {
    usedModel = model || 'gpt-3.5-turbo';
    response = await openaiChat(
      prompt,
      {
        model: usedModel,
        maxTokens,
        temperature
      },
      req.id
    );
  } else {
    throw new AppError(`Unsupported provider: ${provider}`, 400, true, ERROR_CODES.BAD_REQUEST);
  }

  logger.info('AI chat request completed successfully');

  res.json({
    success: true,
    data: {
      prompt,
      response,
      provider,
      model: usedModel
    },
    message: 'AI response generated successfully'
  });
});

export const AIchatWithHistory = catchAsync(async (req, res) => {
  const { messages, provider = 'gemini', model, maxTokens = 500, temperature = 0.7 } = req.body;

  logger.info('Processing AI chat with history', {
    messageCount: messages.length,
    provider,
    model
  });

  let response;
  let usedModel;

  if (provider === 'gemini') {
    usedModel = model || 'gemini-2.0-flash-exp';
    response = await geminiChatWithHistory(
      messages,
      {
        model: usedModel,
        maxTokens,
        temperature
      },
      req.id
    );
  } else if (provider === 'openai') {
    usedModel = model || 'gpt-3.5-turbo';
    response = await openaiChatWithHistory(
      messages,
      {
        model: usedModel,
        maxTokens,
        temperature
      },
      req.id
    );
  } else {
    throw new AppError(`Unsupported provider: ${provider}`, 400, true, ERROR_CODES.BAD_REQUEST);
  }

  logger.info('AI chat with history completed successfully');

  res.json({
    success: true,
    data: {
      messages,
      response,
      provider,
      model: usedModel
    },
    message: 'AI response generated successfully'
  });
});

export const getExamples = catchAsync(async (req, res) => {
  const examples = [
    {
      category: 'Creative Writing',
      prompts: [
        'Write a short story about a time traveler',
        'Create a poem about nature',
        'Generate a creative product description for a smart watch'
      ]
    },
    {
      category: 'Code Assistance',
      prompts: ['Explain what a closure is in JavaScript', 'Write a function to reverse a string in Python', 'How do I use async/await in Node.js?']
    },
    {
      category: 'General Knowledge',
      prompts: [
        'Explain quantum computing in simple terms',
        'What are the main differences between React and Vue?',
        'Summarize the history of the Internet'
      ]
    },
    {
      category: 'Problem Solving',
      prompts: [
        'How can I improve my time management?',
        'What are best practices for API design?',
        'Give me tips for learning a new programming language'
      ]
    }
  ];

  res.json({
    success: true,
    data: examples,
    message: 'Example prompts retrieved successfully'
  });
});
