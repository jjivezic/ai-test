import express from 'express';
import { getAllPaginated, getAll, getById, create, update, deleteProduct } from './controller.js';
// import authMiddleware from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import { paginate, sort, filter } from '../../middleware/queryHelpers.js';
import { createProductSchema, updateProductSchema, idParamSchema } from './validation.js';

const router = express.Router();

// All routes require authentication
// router.use(authMiddleware);

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Get all products with pagination, sorting, and filtering
 *     description: |
 *       **Available Filter Fields:**
 *       - `name`, `price`, `description`, `user_id`, `stock`
 *       
 *       **Available Sort Fields:**
 *       - `name`, `price`, `created_at`, `updated_at`
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
 *       GET /api/products?page=1&limit=10
 *       GET /api/products?sortBy=price&sortOrder=asc
 *       GET /api/products?filter[user_id]=1
 *       GET /api/products?filter[user_id]=1&filter[stock][lte]=50&filter[price][gte]=100
 *       GET /api/products?filter[name][like]=phone
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
 *           enum: [name, price, created_at, updated_at]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: filter[user_id]
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: filter[stock][lte]
 *         schema:
 *           type: integer
 *         example: 50
 *     responses:
 *       200:
 *         description: Paginated list of products
 */
router.get(
  '/',
  paginate,
  sort(['name', 'price', 'created_at', 'updated_at']),
  filter(['name', 'price', 'description', 'user_id', 'stock']),
  getAllPaginated
);

/**
 * @swagger
 * /api/products/all:
 *   get:
 *     tags: [Products]
 *     summary: Get all products without pagination (supports sorting and filtering)
 *     description: |
 *       **Available Filter Fields:**
 *       - `name`, `price`, `description`, `user_id`, `stock`
 *       
 *       **Available Sort Fields:**
 *       - `name`, `price`, `created_at`, `updated_at`
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
 *       GET /api/products/all
 *       GET /api/products/all?sortBy=price&sortOrder=asc
 *       GET /api/products/all?filter[user_id]=1
 *       GET /api/products/all?filter[user_id]=1&filter[stock][lte]=50&filter[price][gte]=100
 *       GET /api/products/all?filter[name][like]=phone
 *       ```
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, price, created_at, updated_at]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: filter[user_id]
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: filter[stock][lte]
 *         schema:
 *           type: integer
 *         example: 50
 *     responses:
 *       200:
 *         description: All products
 */
router.get(
  '/all',
  sort(['name', 'price', 'created_at', 'updated_at']),
  filter(['name', 'price', 'description', 'user_id', 'stock']),
  getAll
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by ID
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
 *         description: Product details
 *       404:
 *         description: Product not found
 */
router.get('/:id', validate(idParamSchema, 'params'), getById);

/**
 * @swagger
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - user_id
 *             properties:
 *               name:
 *                 type: string
 *                 example: Product Name
 *               description:
 *                 type: string
 *                 example: Product description
 *               price:
 *                 type: number
 *                 example: 99.99
 *               stock:
 *                 type: integer
 *                 example: 100
 *               user_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', validate(createProductSchema), create);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Update a product
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
router.put('/:id', validate(idParamSchema, 'params'), validate(updateProductSchema), update);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product
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
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */
router.delete('/:id', validate(idParamSchema, 'params'), deleteProduct);

export default router;
