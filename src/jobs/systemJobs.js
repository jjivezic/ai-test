import { registerJob } from '../services/cronService.js';
import logger from '../config/logger.js';
import db from '../../database/models/index.js';
import ingestDriveFolder from '../services/driveIngestionService.js';

/**
 * System monitoring and health check jobs
 */

export const healthCheck = () => {
  registerJob(
    'health-check',
    '*/5 * * * *', // Every 5 minutes
    async () => {
      const checks = {
        database: false,
        memory: false,
        uptime: process.uptime()
      };

      try {
        // Check database connection
        await db.sequelize.authenticate();
        checks.database = true;
      } catch (error) {
        logger.error(`Health check failed - Database: ${error.message}`);
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
      const memTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
      checks.memory = true;

      // Log health status
      if (checks.database && checks.memory) {
        logger.debug(`Health check OK - DB: connected, Memory: ${memUsedMB}/${memTotalMB}MB, Uptime: ${Math.floor(checks.uptime)}s`);
      } else {
        logger.warn('Health check WARNING - Some services are down', checks);
      }
    }
  );
};

export const generateAnalytics = () => {
  registerJob(
    'generate-analytics',
    '0 0 * * *', // Daily at midnight
    async () => {
      logger.info('Generating analytics...');
      // Analytics generation logic
    }
  );
};

export const syncDriveFolder = () => {
  registerJob(
    'sync-drive-folder',
    '0 0 * * *', // Daily at midnight
    async () => {
      logger.info('[DRIVE-SYNC] Starting Google Drive folder sync...');
      try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
          logger.error('[DRIVE-SYNC] GOOGLE_DRIVE_FOLDER_ID not configured');
          return;
        }
        await ingestDriveFolder(folderId);
        logger.info('[DRIVE-SYNC] Sync completed successfully');
      } catch (error) {
        logger.error(`[DRIVE-SYNC] Sync failed: ${error.message}`, { stack: error.stack });
      }
    }
  );
};
