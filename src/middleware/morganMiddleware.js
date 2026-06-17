import morgan from 'morgan';
import logger from '../config/logger.js';

// Create a stream object that will be used by Morgan
const stream = {
  write: (message) => logger.http(message.trim()),
};

// Skip logging during tests
const skip = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'test';
};

// Build the morgan middleware
const morganMiddleware = morgan(
  ':remote-addr :method :url :status :res[content-length] - :response-time ms',
  { stream, skip }
);

export default morganMiddleware;
