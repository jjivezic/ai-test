import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import xss from 'xss-clean';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import routes from './routes/index.js';
import db from '../database/models/index.js';
import logger from './config/logger.js';
import morganMiddleware from './middleware/morganMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './config/swagger.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { validateEnv } from './config/validateEnv.js';
import { initializeJobs } from './jobs/index.js';
import { startAllJobs } from './services/cronService.js';
import { requestIdMiddleware } from './middleware/requestId.js';

dotenv.config();

// Validate environment variables
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Request ID middleware (first, so all logs have it)
app.use(requestIdMiddleware);

// Security middleware
/* eslint-disable */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
}));
/* eslint-enable */

// CORS middleware
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['X-Refresh-Token']
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data sanitization against XSS attacks
app.use(xss());

// Gzip compression
app.use(compression());

// HTTP request logger
app.use(morganMiddleware);

// Rate limiting
app.use(generalLimiter);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve static files (admin panel)
app.use('/admin', express.static('public'));

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Not Found - ${req.originalUrl} - ${req.method} `);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Sync database (only in development)
  // In Production, use manual migrations instead: npm run db:migrate
  if (process.env.NODE_ENV === 'development') {
    try {
      await db.sequelize.sync({ alter: false });
      logger.info('Database synchronized');
    } catch (error) {
      logger.error(`Database sync failed: ${error.message}`);
    }
  }

  // Initialize and start cron jobs

  initializeJobs();
  startAllJobs();
  logger.info('Cron jobs started');

});

export default app;
