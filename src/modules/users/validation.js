import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(255).required().messages({
    'string.empty': 'Name is required',
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must not exceed 255 characters'
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).max(255).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 6 characters',
    'string.max': 'Password must not exceed 255 characters',
    'any.required': 'Password is required'
  })
});

export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must not exceed 255 characters'
  }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Please provide a valid email address'
  })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'number.base': 'ID must be a number',
    'number.positive': 'ID must be a positive number',
    'any.required': 'ID is required'
  })
});
