import cron from 'node-cron';
import logger from '../config/logger.js';

/**
 * Cron Job Service
 * Manages scheduled tasks for the application
 * 
 * Cron Format: * * * * *
 * ┬ ┬ ┬ ┬ ┬
 * │ │ │ │ │
 * │ │ │ │ └──── Day of week (0-7, 0 or 7 is Sunday)
 * │ │ │ └────── Month (1-12)
 * │ │ └──────── Day of month (1-31)
 * │ └────────── Hour (0-23)
 * └──────────── Minute (0-59)
 */

const jobs = [];

/**
 * Register a cron job
 * @param {string} name - Job name for logging
 * @param {string} schedule - Cron expression
 * @param {Function} task - Task function to execute
 * @param {Object} options - Additional options (timezone, runOnInit)
 * @returns {Object} - Cron job instance
 */
export const registerJob = (name, schedule, task, options = {}) => {
  // Validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Job name is required and must be a non-empty string');
  }

  // Validate schedule
  if (!schedule || typeof schedule !== 'string') {
    throw new Error('Schedule is required and must be a valid cron expression');
  }

  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: ${schedule}`);
  }

  // Validate task
  if (!task || typeof task !== 'function') {
    throw new Error('Task is required and must be a function');
  }

  // Check for duplicate job names
  if (jobs.find(j => j.name === name)) {
    throw new Error(`Job with name "${name}" already exists`);
  }

  try {
    const job = cron.schedule(schedule, async () => {
      logger.info(`[CRON] Starting job: ${name}`);
      const startTime = Date.now();
      
      try {
        await task();
        const duration = Date.now() - startTime;
        logger.info(`[CRON] Completed job: ${name} (${duration}ms)`);
      } catch (error) {
        logger.error(`[CRON] Job failed: ${name} - ${error.message}`);
      }
    }, {
      scheduled: false,
      timezone: options.timezone || 'America/New_York',
      ...options
    });

    jobs.push({ name, schedule, job, task, options });
    logger.info(`[CRON] Registered job: ${name} (${schedule})`);
    
    return job;
  } catch (error) {
    logger.error(`[CRON] Failed to register job: ${name} - ${error.message}`);
    throw error;
  }
};

/**
 * Start all registered cron jobs
 */
export const startAllJobs = () => {
  jobs.forEach(({ name, job, task, options }) => {
    job.start();
    logger.info(`[CRON] Started job: ${name}`);
    
    // Run immediately on initialization if specified
    if (options.runOnInit) {
      logger.info(`[CRON] Running ${name} on initialization`);
      task().catch(error => {
        logger.error(`[CRON] Init run failed for ${name}: ${error.message}`);
      });
    }
  });
};

/**
 * Stop all cron jobs
 */
export const stopAllJobs = () => {
  jobs.forEach(({ name, job }) => {
    job.stop();
    logger.info(`[CRON] Stopped job: ${name}`);
  });
};

/**
 * Get all registered jobs
 * @returns {Array} - List of registered jobs
 */
export const getJobs = () => {
  return jobs.map(({ name, schedule, options }) => ({
    name,
    schedule,
    timezone: options.timezone || 'America/New_York'
  }));
};

/**
 * Stop a specific job by name
 * @param {string} name - Job name
 */
export const stopJob = (name) => {
  const jobEntry = jobs.find(j => j.name === name);
  if (jobEntry) {
    jobEntry.job.stop();
    logger.info(`[CRON] Stopped job: ${name}`);
  } else {
    logger.warn(`[CRON] Job not found: ${name}`);
  }
};

/**
 * Start a specific job by name
 * @param {string} name - Job name
 */
export const startJob = (name) => {
  const jobEntry = jobs.find(j => j.name === name);
  if (jobEntry) {
    jobEntry.job.start();
    logger.info(`[CRON] Started job: ${name}`);
  } else {
    logger.warn(`[CRON] Job not found: ${name}`);
  }
};

export default {
  registerJob,
  startAllJobs,
  stopAllJobs,
  getJobs,
  stopJob,
  startJob
};
