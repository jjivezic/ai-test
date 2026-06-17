import { catchAsync } from '../../middleware/errorHandler.js';
import emailService from '../../services/emailService.js';
import db from '../../../database/models/index.js';
import logger from '../../config/logger.js';

// GET /api/health - Basic health check
export const checkHealth = catchAsync(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  };

  res.status(200).json({
    success: true,
    data: health
  });
});

// GET /api/health/detailed - Detailed health with all services
export const checkDetailedHealth = catchAsync(async (req, res) => {
  
  // Check database connection
  let dbHealth = { healthy: false, error: null };
  try {
    await db.sequelize.authenticate();
    dbHealth = { healthy: true, connected: true };
  } catch (error) {
    dbHealth = { healthy: false, error: error.message };
    logger.error(`Database health check failed: ${error.message}`);
  }

  // Check email service
  const emailHealth = emailService.getStatus();

  // Overall health status
  const isHealthy = dbHealth.healthy && emailHealth.healthy;

  const health = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {
      database: dbHealth,
      email: emailHealth,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    }
  };

  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: isHealthy,
    data: health
  });
});
