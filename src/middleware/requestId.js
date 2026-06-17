import { randomUUID } from 'crypto';

export const requestIdMiddleware = (req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};
