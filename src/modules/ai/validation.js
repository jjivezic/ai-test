import Joi from 'joi';

export const chatValidation = Joi.object({
  prompt: Joi.string().required().min(1).max(5000).messages({
    'string.empty': 'Prompt cannot be empty',
    'string.min': 'Prompt must be at least 1 character',
    'string.max': 'Prompt cannot exceed 5000 characters',
    'any.required': 'Prompt is required',
  }),
  provider: Joi.string()
    .valid('openai', 'gemini')
    .optional()
    .default('gemini')
    .messages({
      'any.only': 'Provider must be either openai or gemini',
    }),
  model: Joi.string().optional().messages({
    'string.base': 'Model must be a string',
  }),
  maxTokens: Joi.number().integer().min(1).max(8000).optional().default(500),
  temperature: Joi.number().min(0).max(2).optional().default(0.7),
});

export const chatWithHistoryValidation = Joi.object({
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('system', 'user', 'assistant').required(),
        content: Joi.string().required().min(1).max(5000),
      })
    )
    .required()
    .min(1)
    .max(50),
  provider: Joi.string()
    .valid('openai', 'gemini')
    .optional()
    .default('gemini')
    .messages({
      'any.only': 'Provider must be either openai or gemini',
    }),
  model: Joi.string().optional().messages({
    'string.base': 'Model must be a string',
  }),
  maxTokens: Joi.number().integer().min(1).max(8000).optional().default(500),
  temperature: Joi.number().min(0).max(2).optional().default(0.7),
});
