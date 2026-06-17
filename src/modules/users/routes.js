import express from 'express';
import { getAllUsersPaginated, getAllUsers, getUserById, updateUser, deleteUser } from './controller.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import { paginate, sort, filter } from '../../middleware/queryHelpers.js';
import { updateUserSchema, idParamSchema } from './validation.js';

const router = express.Router();

// All user routes are protected
router.use(authMiddleware);

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users with pagination, sorting, and filtering
 *     description: |
 *       **Available Filter Fields:**
 *       - `name`, `email`
 *       
 *       **Available Sort Fields:**
 *       - `name`, `email`, `created_at`, `updated_at`
 *       
 *       **Filter Operators:**
 *       - Exact: `filter[field]=value`
 *       - Greater/Equal: `filter[field][gte]=value`
 *       - Less/Equal: `filter[field][lte]=value`
 *       - Greater: `filter[field][gt]=value`
 *       - Less: `filter[field][lt]=value`
 *       - Contains: `filter[field][like]=value`
 *       - In list: `filter[field][in]=1,2,3`
 *       
 *       **Example Routes:**
 *       ```
 *       GET /api/users?page=1&limit=10
 *       GET /api/users?sortBy=name&sortOrder=asc
 *       GET /api/users?filter[email][like]=gmail
 *       GET /api/users?filter[name][like]=john&sortBy=created_at&sortOrder=desc
 *       ```
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, email, created_at, updated_at]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: filter[name][like]
 *         schema:
 *           type: string
 *         example: john
 *       - in: query
 *         name: filter[email][like]
 *         schema:
 *           type: string
 *         example: gmail
 *     responses:
 *       200:
 *         description: Paginated list of users
 */
router.get(
  '/',
  paginate,
  sort(['name', 'email', 'created_at', 'updated_at']),
  filter(['name', 'email']),
  getAllUsersPaginated
);

/**
 * @swagger
 * /api/users/all:
 *   get:
 *     tags: [Users]
 *     summary: Get all users without pagination (supports sorting and filtering)
 *     description: |
 *       **Available Filter Fields:**
 *       - `name`, `email`
 *       
 *       **Available Sort Fields:**
 *       - `name`, `email`, `created_at`, `updated_at`
 *       
 *       **Filter Operators:**
 *       - Exact: `filter[field]=value`
 *       - Greater/Equal: `filter[field][gte]=value`
 *       - Less/Equal: `filter[field][lte]=value`
 *       - Greater: `filter[field][gt]=value`
 *       - Less: `filter[field][lt]=value`
 *       - Contains: `filter[field][like]=value`
 *       - In list: `filter[field][in]=1,2,3`
 *       
 *       **Example Routes:**
 *       ```
 *       GET /api/users/all
 *       GET /api/users/all?sortBy=name&sortOrder=asc
 *       GET /api/users/all?filter[email][like]=gmail
 *       GET /api/users/all?filter[name][like]=john&sortBy=created_at&sortOrder=desc
 *       ```
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, email, created_at, updated_at]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: filter[name][like]
 *         schema:
 *           type: string
 *         example: john
 *       - in: query
 *         name: filter[email][like]
 *         schema:
 *           type: string
 *         example: gmail
 *     responses:
 *       200:
 *         description: All users
 */
router.get(
  '/all',
  sort(['name', 'email', 'created_at', 'updated_at']),
  filter(['name', 'email']),
  getAllUsers
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:id', validate(idParamSchema, 'params'), getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put('/:id', validate(idParamSchema, 'params'), validate(updateUserSchema), updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/:id', validate(idParamSchema, 'params'), deleteUser);

export default router;
