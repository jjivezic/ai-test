import { registerJob } from './service.js';
import logger from '../config/logger.js';

/**
 * Database maintenance jobs
 */

export const databaseBackup = () => {
  registerJob(
    'database-backup',
    '0 2 * * 0', // Every Sunday at 2 AM
    async () => {
      logger.info('Starting database backup...');
      // Backup logic here
    }
  );
};


