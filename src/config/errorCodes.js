/**
 * Error Codes
 * Centralized error codes for consistent error handling across the application
 */

export const ERROR_CODES = {
  // Authentication & Authorization
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NO_TOKEN: 'NO_TOKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  INVALID_EMAIL: 'INVALID_EMAIL',
  FIELD_TOO_SHORT: 'FIELD_TOO_SHORT',
  FIELD_TOO_LONG: 'FIELD_TOO_LONG',
  
  // Database
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  NOT_FOUND: 'NOT_FOUND',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // General
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * Common Error Messages
 * Pre-defined error messages with status codes
 */
export const COMMON_ERRORS = {
  NOT_FOUND: {
    message: 'Resource not found',
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND
  },
  UNAUTHORIZED: {
    message: 'Unauthorized access',
    statusCode: 401,
    code: ERROR_CODES.UNAUTHORIZED
  },
  FORBIDDEN: {
    message: 'Access forbidden',
    statusCode: 403,
    code: ERROR_CODES.FORBIDDEN
  },
  BAD_REQUEST: {
    message: 'Bad request',
    statusCode: 400,
    code: ERROR_CODES.BAD_REQUEST
  },
  INTERNAL_ERROR: {
    message: 'Internal server error',
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR
  },
  INVALID_CREDENTIALS: {
    message: 'Invalid credentials',
    statusCode: 401,
    code: ERROR_CODES.INVALID_CREDENTIALS
  },
  DUPLICATE_ENTRY: {
    message: 'Resource already exists',
    statusCode: 409,
    code: ERROR_CODES.DUPLICATE_ENTRY
  }
};

export default ERROR_CODES;
