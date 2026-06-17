import express from 'express';
import { AIchat, AIchatWithHistory, getExamples } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { chatValidation, chatWithHistoryValidation } from './validation.js';
import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI integration endpoints (OpenAI & Google Gemini)
 */

/**
 * @swagger
 * /api/ai/examples:
 *   get:
 *     summary: Get example prompts
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: Example prompts returned successfully
 */
router.get('/examples', getExamples);

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Send a simple chat prompt to AI (OpenAI or Gemini)
 *     tags: [AI]
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
 *                 description: The prompt to send to AI
 *                 example: "Explain quantum computing in simple terms"
 *               provider:
 *                 type: string
 *                 enum: [openai, gemini]
 *                 default: gemini
 *                 description: AI provider to use
 *               model:
 *                 type: string
 *                 description: Model name (provider-specific)
 *                 example: "gemini-1.5-flash"
 *               maxTokens:
 *                 type: number
 *                 default: 500
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0.7
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     prompt:
 *                       type: string
 *                     response:
 *                       type: string
 *                     model:
 *                       type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  '/chat',
  // authMiddleware,
  validate(chatValidation),
  AIchat
);

/**
 * @swagger
 * /api/ai/chat-history:
 *   post:
 *     summary: Send a conversation with history (OpenAI or Gemini)
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: string
 *                 example:
 *                   - role: "system"
 *                     content: "You are a helpful assistant"
 *                   - role: "user"
 *                     content: "What is the capital of France?"
 *                   - role: "assistant"
 *                     content: "The capital of France is Paris"
 *                   - role: "user"
 *                     content: "What about Spain?"
 *               provider:
 *                 type: string
 *                 enum: [openai, gemini]
 *                 default: gemini
 *               model:
 *                 type: string
 *                 description: Model name (provider-specific)
 *                 example: "gemini-2.0-flash-exp"
 *               maxTokens:
 *                 type: number
 *                 default: 500
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0.7
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/chat-history', authMiddleware, validate(chatWithHistoryValidation), AIchatWithHistory);

export default router;
