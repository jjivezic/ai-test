import logger from '../config/logger.js';
import { ERROR_CODES, COMMON_ERRORS } from '../config/errorCodes.js';

class AppError extends Error {
  constructor(message, statusCode, isOperational = true, code = null) {
    // If message is a COMMON_ERROR, use its properties
    if (typeof message === 'object' && message.message) {
      super(message.message);
      this.statusCode = message.statusCode;
      this.code = message.code;
      this.isOperational = true;
    } else {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.isOperational = isOperational;
    }
    this.status = `${this.statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    err.statusCode = 400;
    err.status = 'fail';
    err.isOperational = true;
    err.code = err.name === 'SequelizeUniqueConstraintError' 
      ? ERROR_CODES.DUPLICATE_ENTRY 
      : ERROR_CODES.VALIDATION_ERROR;
    
    // Create human-readable error message
    const errors = err.errors.map((e) => {
      if (e.type === 'notNull Violation') {
        const field = e.path;
        return `${field.replace(/_/g, ' ')} is required`;
      }
      if (e.type === 'unique violation') {
        const field = e.path;
        return `${field.replace(/_/g, ' ')} already exists`;
      }
      if (e.validatorKey === 'notEmpty') {
        const field = e.path;
        return `${field.replace(/_/g, ' ')} cannot be empty`;
      }
      if (e.validatorKey === 'isEmail') {
        return 'Invalid email format';
      }
      if (e.validatorKey === 'min') {
        const field = e.path;
        return `${field.replace(/_/g, ' ')} must be at least ${e.validatorArgs[0]}`;
      }
      return e.message;
    });
    
    err.message = errors.join(', ');
  }

  // Handle Sequelize foreign key errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    err.statusCode = 400;
    err.status = 'fail';
    err.isOperational = true;
    err.message = 'Invalid reference - related record does not exist';
    err.code = ERROR_CODES.FOREIGN_KEY_VIOLATION;
  }

  // Handle Sequelize database errors
  if (err.name === 'SequelizeDatabaseError') {
    err.statusCode = 400;
    err.status = 'fail';
    err.isOperational = true;
    err.message = 'Invalid data provided';
    err.code = ERROR_CODES.DATABASE_ERROR;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    err.statusCode = 401;
    err.status = 'fail';
    err.isOperational = true;
    err.message = 'Invalid token';
    err.code = ERROR_CODES.INVALID_TOKEN;
  }

  if (err.name === 'TokenExpiredError') {
    err.statusCode = 401;
    err.status = 'fail';
    err.isOperational = true;
    err.message = 'Token expired';
    err.code = ERROR_CODES.TOKEN_EXPIRED;
  }

  // Log error with stack trace (server-side only)
  const log = logger.withRequestId(req.id);
  
  if (err.statusCode === 500) {
    log.error(`${err.message}\n${err.stack}`);
    log.error(`Request body: ${JSON.stringify(req.body)}`);
  } else {
    log.warn(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method}`);
    // Log request body for debugging
    if (req.body && Object.keys(req.body).length > 0) {
      log.error(`Request body: ${JSON.stringify(req.body)}`);
    }
    // Log stack trace for all errors on server side
    if (err.stack) {
      log.error(`Stack trace:\n${err.stack}`);
    }
  }

  // Always send clean response without stack trace
  const response = {
    success: false,
    status: err.status,
    message: err.message,
  };

  // Add error code if present (for frontend to handle specific errors)
  if (err.code) {
    response.code = err.code;
  }

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json(response);
  }

  // Programming or unknown error: don't leak error details
  logger.error('ERROR 💥', err);
  return res.status(500).json({
    success: false,
    status: 'error',
    message: 'Something went wrong!',
  });
};

// Catch async errors
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export { 
  AppError, errorHandler, catchAsync, ERROR_CODES, COMMON_ERRORS 
};
