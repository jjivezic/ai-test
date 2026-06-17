import express from 'express';
import { agentExecuteTask } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { executeTaskValidation } from './validation.js';
// import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Agent
 *   description: AI Agent that can autonomously use tools to complete tasks
 */

/**
 * @swagger
 * /api/agent/task:
 *   post:
 *     summary: Execute an autonomous AI agent task
 *     tags: [Agent]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: Task description for the agent
 *                 example: "Find all documents mentioning 'Jelena' and summarize them"
 *               maxIterations:
 *                 type: number
 *                 default: 5
 *                 description: Maximum tool calls allowed
 *     responses:
 *       200:
 *         description: Agent task completed
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/task', validate(executeTaskValidation), agentExecuteTask);

export default router;
