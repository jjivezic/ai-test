import Joi from 'joi';

export const addDocumentsValidation = Joi.object({
  documents: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        text: Joi.string().required().min(1).max(10000),
        metadata: Joi.object().optional().default({}),
      })
    )
    .required()
    .min(1)
    .max(100)
    .messages({
      'array.min': 'At least one document is required',
      'array.max': 'Maximum 100 documents per request',
    }),
});

export const searchValidation = Joi.object({
  query: Joi.string().required().min(1).max(1000).messages({
    'string.empty': 'Query cannot be empty',
    'any.required': 'Query is required',
  }),
  nResults: Joi.number().integer().min(1).max(20).optional().default(5),
  keyword: Joi.string().optional().allow(null, '').max(200).messages({
    'string.max': 'Keyword must be at most 200 characters',
  }),
  maxDistance: Joi.number().min(0).max(2).optional().allow(null).default(1).messages({
    'number.min': 'Max distance must be at least 0',
    'number.max': 'Max distance must be at most 2',
  }),
});

export const deleteDocumentsValidation = Joi.object({
  ids: Joi.array()
    .items(Joi.string().required())
    .required()
    .min(1)
    .max(100)
    .messages({
      'array.min': 'At least one document ID is required',
      'array.max': 'Maximum 100 IDs per request',
    }),
});
