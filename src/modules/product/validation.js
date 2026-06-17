import Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().min(3).max(255).required().messages({
    'string.empty': 'Product name is required',
    'string.min': 'Product name must be at least 3 characters',
    'string.max': 'Product name must not exceed 255 characters'
  }),
  description: Joi.string().allow('', null).optional(),
  price: Joi.number().min(0).required().messages({
    'number.base': 'Price must be a number',
    'number.min': 'Price cannot be negative',
    'any.required': 'Price is required'
  }),
  stock: Joi.number().integer().min(0).default(0).messages({
    'number.base': 'Stock must be a number',
    'number.integer': 'Stock must be an integer',
    'number.min': 'Stock cannot be negative'
  }),
  user_id: Joi.number().integer().positive().required().messages({
    'number.base': 'User ID must be a number',
    'number.positive': 'User ID must be a positive number',
    'any.required': 'User ID is required'
  })
});

export const updateProductSchema = Joi.object({
  name: Joi.string().min(3).max(255).optional().messages({
    'string.min': 'Product name must be at least 3 characters',
    'string.max': 'Product name must not exceed 255 characters'
  }),
  description: Joi.string().allow('', null).optional(),
  price: Joi.number().min(0).optional().messages({
    'number.base': 'Price must be a number',
    'number.min': 'Price cannot be negative'
  }),
  stock: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Stock must be a number',
    'number.integer': 'Stock must be an integer',
    'number.min': 'Stock cannot be negative'
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
