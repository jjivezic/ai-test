import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppError, COMMON_ERRORS, catchAsync } from './errorHandler.js';

dotenv.config();

const authMiddleware = catchAsync(async (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    throw new AppError('Authorization header is required', 401, true, COMMON_ERRORS.NO_TOKEN);
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new AppError('Authorization header must be in format: Bearer <token>', 401, true, COMMON_ERRORS.INVALID_TOKEN);
  }

  // Extract token
  const token = authHeader.substring(7);

  if (!token) {
    throw new AppError('Token is missing', 401, true, COMMON_ERRORS.NO_TOKEN);
  }

  // Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  // Attach user info to request
  req.user = decoded;
  
  next();
});

export default authMiddleware;
