import logger from '../config/logger.js';

// Import job categories
import * as databaseJobs from './databaseJobs.js';
import * as systemJobs from './systemJobs.js';

/**
 * Initialize all cron jobs
 * Enable/disable jobs by commenting/uncommenting
 */
export const initializeJobs = () => {
  logger.info('[CRON] Initializing jobs...');

  // Database Jobs
  databaseJobs.databaseBackup();

  // System Jobs
  systemJobs.healthCheck();
  systemJobs.generateAnalytics();
  systemJobs.syncDriveFolder();

  logger.info('[CRON] All jobs initialized');
};

export default initializeJobs;
