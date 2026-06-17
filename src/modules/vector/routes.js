import express from 'express';
import {
  addVectorDocuments,
  searchVectorDocuments,
  getDocumentStats,
  getAllVectorDocuments,
  deleteVectorDocuments,
  resetVectorDocuments
} from './controller.js';
import { validate } from '../../middleware/validate.js';
import { addDocumentsValidation, searchValidation, deleteDocumentsValidation } from './validation.js';
// import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
// router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Vector
 *   description: Vector database operations for RAG
 */

/**
 * @swagger
 * /api/vector/add:
 *   post:
 *     summary: Add documents to vector database
 *     tags: [Vector]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     text:
 *                       type: string
 *                     metadata:
 *                       type: object
 *                 example:
 *                   - id: "doc1"
 *                     text: "Node.js is a JavaScript runtime"
 *                     metadata:
 *                       fileName: "nodejs-guide.txt"
 *                       category: "programming"
 *     responses:
 *       200:
 *         description: Documents added successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  '/add',
  validate(addDocumentsValidation),
  addVectorDocuments
);

/**
 * @swagger
 * /api/vector/search:
 *   post:
 *     summary: Search for similar documents
 *     tags: [Vector]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 example: "How to use async/await in Node.js?"
 *               nResults:
 *                 type: number
 *                 default: 5
 *               keyword:
 *                 type: string
 *                 description: Exact text to find in documents (case-insensitive)
 *               maxDistance:
 *                 type: number
 *                 description: Maximum distance threshold (lower = more similar)
 *     responses:
 *       200:
 *         description: Search results returned
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  '/search',
  validate(searchValidation),
  searchVectorDocuments
);

/**
 * @swagger
 * /api/vector/stats:
 *   get:
 *     summary: Get vector database statistics
 *     tags: [Vector]
 *     responses:
 *       200:
 *         description: Statistics returned
 */
router.get('/stats', getDocumentStats);

/**
 * @swagger
 * /api/vector/all:
 *   get:
 *     summary: Get all documents
 *     tags: [Vector]
 *     responses:
 *       200:
 *         description: All documents returned
 */
router.get('/all', getAllVectorDocuments);

/**
 * @swagger
 * /api/vector/delete:
 *   post:
 *     summary: Delete documents by IDs
 *     tags: [Vector]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["doc1", "doc2"]
 *     responses:
 *       200:
 *         description: Documents deleted
 */
router.post('/delete', validate(deleteDocumentsValidation), deleteVectorDocuments);

/**
 * @swagger
 * /api/vector/reset:
 *   post:
 *     summary: Reset vector database (delete all documents)
 *     tags: [Vector]
 *     responses:
 *       200:
 *         description: Database reset
 */
router.post('/reset', resetVectorDocuments);

export default router;
