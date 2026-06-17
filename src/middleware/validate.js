import { AppError } from './errorHandler.js';
import logger from '../config/logger.js';

export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const log = logger.withRequestId(req.id);
    
    // Log incoming request data
    log.debug(`Validation - ${req.method} ${req.path} - ${source}: ${JSON.stringify(data)}`);
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      log.warn(`Validation failed - ${req.method} ${req.path} - ${source}: ${JSON.stringify(data)} - Error: ${message}`);
      throw new AppError(message, 400);
    }

    req[source] = value;
    next();
  };
};
