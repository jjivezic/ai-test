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
