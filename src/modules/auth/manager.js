import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import db from '../../../database/models/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';
import emailService from '../../services/emailService.js';

const { User } = db;
dotenv.config();

export const register = async (email, password, name) => {
  logger.info(`Registration attempt - email: ${email}, name: ${name}`);
  
  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });

  if (existingUser) {
    logger.warn(`Registration failed: User already exists - ${email}`);
    throw new AppError('User already exists', 409);
  }

  // Hash password with 12 rounds (per coding standards)
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await User.create({
    email,
    password: hashedPassword,
    name
  });

  // Send welcome email (non-blocking)
  emailService.sendWelcomeEmail(user).catch(err => {
    logger.error(`Failed to send welcome email to ${user.email}: ${err.message}`);
  });

  logger.info(`Registration successful - user ID: ${user.id}, email: ${user.email}`);

  return {
    id: user.id,
    email: user.email,
    name: user.name
  };
};

export const login = async (email, password) => {
  logger.info(`Login attempt - email: ${email}`);
  
  const user = await User.findOne({ where: { email } });

  if (!user) {
    logger.warn(`Login failed: User not found - email: ${email}`);
    throw new AppError('Invalid credentials', 401);
  }

  // Check if account is locked
  if (user.account_locked_until && new Date() < new Date(user.account_locked_until)) {
    const lockTimeRemaining = Math.ceil((new Date(user.account_locked_until) - new Date()) / 1000 / 60);
    logger.warn(`Login failed: Account locked - ${email}`);
    throw new AppError(`Account is locked. Try again in ${lockTimeRemaining} minutes`, 423);
  }

  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    // Increment failed attempts
    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    
    if (failedAttempts >= 5) {
      // Lock account for 15 minutes after 5 failed attempts
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await user.update({ 
        failed_login_attempts: failedAttempts,
        account_locked_until: lockUntil
      });
      logger.warn(`Account locked due to failed attempts - ${email}`);
      throw new AppError('Account locked due to too many failed attempts. Try again in 15 minutes', 423);
    }
    
    await user.update({ failed_login_attempts: failedAttempts });
    logger.warn(`Login failed: Invalid password - ${email} (attempt ${failedAttempts}/5)`);
    throw new AppError('Invalid credentials', 401);
  }

  // Reset failed attempts on successful login
  await user.update({ 
    failed_login_attempts: 0,
    account_locked_until: null
  });

  const accessToken = jwt.sign(
    { 
      id: user.id, 
      email: user.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  // Hash refresh token before storing (security best practice)
  const hashedRefreshToken = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  await user.update({ refresh_token: hashedRefreshToken });

  logger.info(`Login successful - user ID: ${user.id}, email: ${user.email}`);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  };
};

export const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    const user = await User.findByPk(decoded.id);
    
    // Hash the provided token and compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    
    if (!user || user.refresh_token !== hashedToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    const newAccessToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    return {
      accessToken: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired refresh token', 401);
  }
};

export const logout = async (userId) => {
  // Remove refresh token from database
  await User.update(
    { refresh_token: null },
    { where: { id: userId } }
  );
  
  return { success: true };
};

export const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new AppError('Invalid token', 401);
  }
};
