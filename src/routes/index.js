import express from 'express';
import authRoutes from '../modules/auth/routes.js';
import userRoutes from '../modules/users/routes.js';
import productRoutes from '../modules/product/routes.js';
import healthRoutes from '../modules/health/routes.js';
import aiRoutes from '../modules/ai/routes.js';
import vectorRoutes from '../modules/vector/routes.js';
import agentRoutes from '../modules/agent/routes.js';

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/health', healthRoutes);
router.use('/ai', aiRoutes);
router.use('/vector', vectorRoutes);
router.use('/agent', agentRoutes);

export default router;
