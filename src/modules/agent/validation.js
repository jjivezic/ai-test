import Joi from 'joi';

export const executeTaskValidation = Joi.object({
  prompt: Joi.string().required().min(3).max(1000).messages({
    'string.empty': 'Prompt is required',
    'string.min': 'Prompt must be at least 3 characters',
    'string.max': 'Prompt must not exceed 1000 characters',
    'any.required': 'Prompt is required'
  }),
  maxIterations: Joi.number().integer().min(1).max(10).default(5).messages({
    'number.base': 'Max iterations must be a number',
    'number.integer': 'Max iterations must be an integer',
    'number.min': 'Max iterations must be at least 1',
    'number.max': 'Max iterations cannot exceed 10'
  })
});

