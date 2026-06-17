import express from 'express';
import { checkHealth, checkDetailedHealth } from './controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Basic health check
 *     description: Returns basic server health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                       example: 3600.5
 *                     environment:
 *                       type: string
 *                       example: development
 */
router.get('/', checkHealth);

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Returns detailed health status including database and email service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                     environment:
 *                       type: string
 *                     services:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             healthy:
 *                               type: boolean
 *                             connected:
 *                               type: boolean
 *                         email:
 *                           type: object
 *                           properties:
 *                             healthy:
 *                               type: boolean
 *                             metrics:
 *                               type: object
 *                               properties:
 *                                 sent:
 *                                   type: number
 *                                 failed:
 *                                   type: number
 *                                 lastSuccess:
 *                                   type: string
 *                                 lastError:
 *                                   type: object
 *                         memory:
 *                           type: object
 *                           properties:
 *                             used:
 *                               type: number
 *                             total:
 *                               type: number
 *                             unit:
 *                               type: string
 *       503:
 *         description: One or more services are degraded
 */
router.get('/detailed', checkDetailedHealth);

export default router;
