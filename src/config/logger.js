import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => {
      const reqId = info.requestId ? `[${info.requestId}] ` : '';
      return `${info.timestamp} ${info.level}: ${reqId}${info.message}`;
    }
  )
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console(),
  
  // Error logs - daily rotation
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m', // Rotate if file exceeds 20MB
    maxFiles: '30d', // Keep logs for 30 days
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // All logs - daily rotation
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels,
  format,
  transports,
});

// Helper to add request ID to logs
logger.withRequestId = (requestId) => {
  return {
    error: (message) => logger.error(message, { requestId }),
    warn: (message) => logger.warn(message, { requestId }),
    info: (message) => logger.info(message, { requestId }),
    http: (message) => logger.http(message, { requestId }),
    debug: (message) => logger.debug(message, { requestId })
  };
};

export default logger;
