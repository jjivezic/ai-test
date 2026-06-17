import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { schemas } from './schema-definition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get model name from command line
const modelName = process.argv[2];

if (!modelName) {
  console.error('❌ Please provide a model name: node database/schema-generator.js <ModelName>');
  process.exit(1);
}

if (!schemas[modelName]) {
  console.error(`❌ Model "${modelName}" not found in schema-definition.js`);
  console.log('Available models:', Object.keys(schemas).join(', '));
  process.exit(1);
}

const schema = schemas[modelName];
const moduleName = modelName.toLowerCase();

// Check if model already exists
const modelPath = path.join(__dirname, 'models', `${modelName}.js`);
const modulePath = path.join(__dirname, '..', 'src', 'modules', moduleName);

if (fs.existsSync(modelPath) || fs.existsSync(modulePath)) {
  console.error(`❌ ${modelName} already exists! ${modelPath} `);
  //empty  spaces for proper indentation in the generated code 
  console.log(`   Model: ${fs.existsSync(modelPath) ? '✓' : '✗'}`); 
  console.log(`   Module: ${fs.existsSync(modulePath) ? '✓' : '✗'}`);
  console.log('\nTo regenerate, delete the existing files first:');
  console.log(`   rm database/models/${modelName}.js`);
  console.log(`   rm -rf src/modules/${moduleName}`);
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '');
const fileName = `${timestamp}-create-${schema.tableName}-table.cjs`;
const filePath = path.join(__dirname, 'migrations', fileName);

// Generate field definitions for migration
function generateFields(fields) {
  return Object.entries(fields)
    .map(([fieldName, config]) => {
     //empty  spaces for proper indentation in the generated code 
      const lines = [`      ${fieldName}: {`];
      
      // Add type
      lines.push(`        type: Sequelize.${config.type},`);
      
      // Add other properties
      if (config.primaryKey) lines.push('        primaryKey: true,');
      if (config.autoIncrement) lines.push('        autoIncrement: true,');
      if (config.allowNull !== undefined) lines.push(`        allowNull: ${config.allowNull},`);
      if (config.unique) lines.push('        unique: true,');
      if (config.defaultValue !== undefined) {
        const value = typeof config.defaultValue === 'string' 
          ? `'${config.defaultValue}'` 
          : config.defaultValue;
        lines.push(`        defaultValue: ${value},`);
      }
      if (config.references) {
        lines.push('        references: {');
        lines.push(`          model: '${config.references.model}',`);
        lines.push(`          key: '${config.references.key}'`);
        lines.push('        },');
        if (config.onDelete) lines.push(`        onDelete: '${config.onDelete}',`);
        if (config.onUpdate) lines.push(`        onUpdate: '${config.onUpdate}',`);
      }
      
      lines.push('      }');
      return lines.join('\n');
    })
    .join(',\n');
}

// Generate indexes for migration
function generateIndexes(tableName, indexes) {
  if (!indexes || indexes.length === 0) return '';
  
  return indexes.map((index, i) => {
    const fields = index.fields.map(f => `'${f}'`).join(', ');
    const unique = index.unique ? ', unique: true' : '';
    return `    await queryInterface.addIndex('${tableName}', [${fields}]${unique});`;
  }).join('\n');
}

// Generate migration file content
const migrationContent = `'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('${schema.tableName}', {
${generateFields(schema.fields)}${schema.timestamps ? `,
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }` : ''}
    });
${generateIndexes(schema.tableName, schema.indexes)}
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('${schema.tableName}');
  }
};
`;

// Generate Sequelize model file
const modelContent = `import { DataTypes } from 'sequelize';
import sequelize from '../connection.js';

const ${modelName} = sequelize.define('${modelName}', {
${Object.entries(schema.fields)
  .map(([fieldName, config]) => {
    const lines = [`  ${fieldName}: {`];
     //empty  spaces for proper indentation in the generated code 
    lines.push(`    type: DataTypes.${config.type},`);
    if (config.primaryKey) lines.push('    primaryKey: true,');
    if (config.autoIncrement) lines.push('    autoIncrement: true,');
    if (config.allowNull !== undefined) lines.push(`    allowNull: ${config.allowNull},`);
    if (config.unique) lines.push('    unique: true,');
    if (config.defaultValue !== undefined) {
      const value = typeof config.defaultValue === 'string' 
        ? `'${config.defaultValue}'` 
        : config.defaultValue;
      lines.push(`    defaultValue: ${value},`); 
    }
    if (config.validate) {
      lines.push('    validate: {');
      Object.entries(config.validate).forEach(([key, value]) => {
        lines.push(`      ${key}: ${JSON.stringify(value)}`);
      });
      lines.push('    },');
    }
    if (config.references) {
      lines.push('    references: {');
      lines.push(`      model: '${config.references.model}',`);
      lines.push(`      key: '${config.references.key}'`);
      lines.push('    },');
      if (config.onDelete) lines.push(`    onDelete: '${config.onDelete}',`);
      if (config.onUpdate) lines.push(`    onUpdate: '${config.onUpdate}',`);
    }
    lines.push('  }');
    return lines.join('\n');
  })
  .join(',\n')}
}, {
  tableName: '${schema.tableName}',
  timestamps: ${schema.timestamps || false},${schema.timestamps ? `
  createdAt: 'created_at',
  updatedAt: 'updated_at',` : ''}${schema.indexes && schema.indexes.length > 0 ? `
  indexes: [
${schema.indexes.map(index => {
  const fields = index.fields.map(f => `'${f}'`).join(', ');
  const unique = index.unique ? ', unique: true' : '';
  return `    { fields: [${fields}]${unique} }`;
}).join(',\n')}
  ]` : ''}
});

export default ${modelName};
`;

// Write migration file
fs.writeFileSync(filePath, migrationContent);
console.log(`✅ Migration created: ${fileName}`);

// Write model file
fs.writeFileSync(modelPath, modelContent);
console.log(`✅ Model created: ${modelName}.js`);

// Create module directory
if (!fs.existsSync(modulePath)) {
  fs.mkdirSync(modulePath, { recursive: true });
}

// Generate Manager
const managerContent = `import db from '../../../database/models/index.js';
import { AppError, COMMON_ERRORS } from '../../middleware/errorHandler.js';

const { ${modelName} } = db;

export const findAll = async (filters = {}, sort = {}) => {
  const order = sort.field ? [[sort.field, sort.order]] : [['created_at', 'DESC']];

  const items = await ${modelName}.findAll({
    where: filters,
    order
  });
  return items;
};

export const findAndCountAll = async (filters = {}, sort = {}, pagination = {}) => {
  const { limit, offset } = pagination;
  const order = sort.field ? [[sort.field, sort.order]] : [['created_at', 'DESC']];

  const { count, rows } = await ${modelName}.findAndCountAll({
    where: filters,
    order,
    limit,
    offset
  });

  return {
    items: rows,
    total: count
  };
};

export const findByPk = async (id) => {
  const item = await ${modelName}.findByPk(id);

  if (!item) {
    throw new AppError(COMMON_ERRORS.NOT_FOUND);
  }

  return item;
};

export const createOne = async (data) => {
  const item = await ${modelName}.create(data);
  return item;
};

export const updateOne = async (id, data) => {
  const item = await ${modelName}.findByPk(id);
  
  if (!item) {
    throw new AppError(COMMON_ERRORS.NOT_FOUND);
  }

  await item.update(data);
  return findByPk(id);
};

export const deleteOne = async (id) => {
  const item = await ${modelName}.findByPk(id);

  if (!item) {
    throw new AppError(COMMON_ERRORS.NOT_FOUND);
  }

  await item.destroy();
  return { success: true };
};
`;

// Generate Controller
const controllerContent = `import { findAll, findAndCountAll, findByPk, createOne, updateOne, deleteOne } from './manager.js';
import { catchAsync } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

export const getAllPaginated = catchAsync(async (req, res) => {
  const { items, total } = await findAndCountAll(
    req.filters || {},
    req.sort || {},
    req.pagination || {}
  );

  res.status(200).json({
    success: true,
    data: items,
    total
  });
});

export const getAll = catchAsync(async (req, res) => {
  const items = await findAll(
    req.filters || {},
    req.sort || {}
  );

  res.status(200).json({
    success: true,
    data: items
  });
});

export const getById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const item = await findByPk(id);

  res.status(200).json({
    success: true,
    data: item
  });
});

export const create = catchAsync(async (req, res) => {
  const item = await createOne(req.body);
  logger.info(\`${modelName} created: \${item.id}\`);

  res.status(201).json({
    success: true,
    message: '${modelName} created successfully',
    data: item
  });
});

export const update = catchAsync(async (req, res) => {
  const { id } = req.params;
  const item = await updateOne(id, req.body);
  logger.info(\`${modelName} updated: \${id}\`);

  res.status(200).json({
    success: true,
    message: '${modelName} updated successfully',
    data: item
  });
});

export const deleteItem = catchAsync(async (req, res) => {
  const { id } = req.params;
  await deleteOne(id);
  logger.info(\`${modelName} deleted: \${id}\`);

  res.status(200).json({
    success: true,
    message: '${modelName} deleted successfully'
  });
});
`;

// Generate Joi validation schemas
function generateJoiValidation(fields) {
  const createFields = [];
  const updateFields = [];

  Object.entries(fields).forEach(([fieldName, config]) => {
    if (fieldName === 'id') return; // Skip id field

    let joiType = 'string()';
    const messages = [];

    // Map Sequelize types to Joi types
    if (config.type.startsWith('INTEGER')) {
      joiType = 'number().integer()';
      messages.push(`'number.base': '${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be a number'`);
      messages.push(`'number.integer': '${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be an integer'`);
    } else if (config.type.startsWith('DECIMAL') || config.type.startsWith('FLOAT')) {
      joiType = 'number()';
      messages.push(`'number.base': '${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be a number'`);
    } else if (config.type === 'BOOLEAN') {
      joiType = 'boolean()';
    } else if (config.type === 'DATE') {
      joiType = 'date()';
    } else if (config.type.startsWith('STRING')) {
      const match = config.type.match(/STRING\((\d+)\)/);
      const maxLength = match ? match[1] : '255';
      joiType = `string().max(${maxLength})`;
      messages.push(`'string.max': '${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must not exceed ${maxLength} characters'`);
    } else if (config.type === 'TEXT') {
      joiType = 'string()';
    }

    // Add validation rules
    if (config.validate) {
      if (config.validate.isEmail) {
        joiType += '.email()';
        messages.push(`'string.email': 'Please provide a valid email address'`);
      }
      if (config.validate.min !== undefined) {
        joiType += `.min(${config.validate.min})`;
        messages.push(`'number.min': '${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} cannot be less than ${config.validate.min}'`);
      }
      if (config.validate.notEmpty) {
        messages.push(`'string.empty': '${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required'`);
      }
    }

    // Build create field (required)
    const isRequired = config.allowNull === false && !config.defaultValue;
    const createValidation = isRequired ? `${joiType}.required()` : `${joiType}.optional()`;
    if (isRequired) {
      messages.push(`'any.required': '${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required'`);
    }

    const messagesStr = messages.length > 0 ? `.messages({\n      ${messages.join(',\n      ')}\n    })` : '';
    createFields.push(`  ${fieldName}: Joi.${createValidation}${messagesStr}`);

    // Build update field (optional)
    const updateValidation = `${joiType}.optional()`;
    const updateMessages = messages.filter(m => !m.includes('any.required') && !m.includes('string.empty'));
    const updateMessagesStr = updateMessages.length > 0 ? `.messages({\n      ${updateMessages.join(',\n      ')}\n    })` : '';
    updateFields.push(`  ${fieldName}: Joi.${updateValidation}${updateMessagesStr}`);
  });

  return {
    createFields: createFields.join(',\n'),
    updateFields: updateFields.join(',\n')
  };
}

const validation = generateJoiValidation(schema.fields);

const validationContent = `import Joi from 'joi';

export const create${modelName}Schema = Joi.object({
${validation.createFields}
});

export const update${modelName}Schema = Joi.object({
${validation.updateFields}
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'number.base': 'ID must be a number',
    'number.positive': 'ID must be a positive number',
    'any.required': 'ID is required'
  })
});
`;

// Generate Routes
const sortFields = schema.api?.sortFields || ['created_at', 'updated_at'];
const filterFields = schema.api?.filterFields || [];
const sortFieldsStr = sortFields.map(f => `'${f}'`).join(', ');
const filterFieldsStr = filterFields.map(f => `'${f}'`).join(', ');

// Format fields for Swagger docs
const sortFieldsDisplay = sortFields.map(f => '`' + f + '`').join(', ');
const filterFieldsDisplay = filterFields.length > 0 ? filterFields.map(f => '`' + f + '`').join(', ') : 'No filters available';

// Generate inline Swagger schema from fields
function generateSwaggerSchema(fields, required = false) {
  const properties = [];
  const requiredFields = [];
  
  Object.entries(fields).forEach(([fieldName, config]) => {
    if (fieldName === 'id') return; // Skip id field
    
    let swaggerType = 'string';
    let format = null;
    let example = null;
    
    if (config.type.includes('INTEGER')) {
      swaggerType = 'integer';
      example = 1;
    } else if (config.type.includes('DECIMAL') || config.type.includes('FLOAT')) {
      swaggerType = 'number';
      example = 99.99;
    } else if (config.type.includes('TEXT')) {
      swaggerType = 'string';
      example = 'Sample text';
    } else if (config.type.includes('STRING')) {
      swaggerType = 'string';
      example = fieldName.includes('email') ? 'user@example.com' : 'Sample ' + fieldName;
    } else if (config.type.includes('DATE')) {
      swaggerType = 'string';
      format = 'date-time';
    } else if (config.type.includes('BOOLEAN')) {
      swaggerType = 'boolean';
      example = true;
    }
    
    const propLines = [];
    propLines.push(` *               ${fieldName}:`);
    propLines.push(` *                 type: ${swaggerType}`);
    if (format) propLines.push(` *                 format: ${format}`);
    if (example !== null) {
      const exampleVal = typeof example === 'string' ? example : example;
      propLines.push(` *                 example: ${exampleVal}`);
    }
    
    properties.push(propLines.join('\n'));
    
    if (required && config.allowNull === false && !config.defaultValue) {
      requiredFields.push(fieldName);
    }
  });
  
  const requiredStr = requiredFields.length > 0 
    ? `\n *             required:\n *               - ${requiredFields.join('\n *               - ')}` 
    : '';
  
  return `type: object${requiredStr}
 *             properties:
${properties.join('\n')}`;
}

const createSchemaStr = generateSwaggerSchema(schema.fields, true);
const updateSchemaStr = generateSwaggerSchema(schema.fields, false);

const routesContent = `import express from 'express';
import { getAllPaginated, getAll, getById, create, update, deleteItem } from './controller.js';
import authMiddleware from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import { paginate, sort, filter } from '../../middleware/queryHelpers.js';
import { create${modelName}Schema, update${modelName}Schema, idParamSchema } from './validation.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/${moduleName}s:
 *   get:
 *     tags: [${modelName}s]
 *     summary: Get all ${moduleName}s with pagination, sorting, and filtering
 *     description: |
 *       **Available Filter Fields:**
 *       - ${filterFieldsDisplay}
 *       
 *       **Available Sort Fields:**
 *       - ${sortFieldsDisplay}
 *       
 *       **Filter Operators:**
 *       - Exact: \`filter[field]=value\`
 *       - Greater/Equal: \`filter[field][gte]=value\`
 *       - Less/Equal: \`filter[field][lte]=value\`
 *       - Greater: \`filter[field][gt]=value\`
 *       - Less: \`filter[field][lt]=value\`
 *       - Contains: \`filter[field][like]=value\`
 *       - In list: \`filter[field][in]=1,2,3\`
 *       
 *       **Example Routes:**
 *       \`\`\`
 *       GET /api/${moduleName}s?page=1&limit=10
 *       GET /api/${moduleName}s?sortBy=${sortFields[0]}&sortOrder=asc
 *       GET /api/${moduleName}s?filter[field][gt]=value&sortBy=${sortFields[0]}&sortOrder=desc
 *       GET /api/${moduleName}s?page=1&limit=10&filter[field]=value&sortBy=${sortFields[0]}&sortOrder=desc
 *       \`\`\`
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
 *           enum: [${sortFieldsStr}]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Paginated list of ${moduleName}s
 */
router.get(
  '/',
  paginate,
  sort([${sortFieldsStr}]),
  filter([${filterFieldsStr}]),
  getAllPaginated
);

/**
 * @swagger
 * /api/${moduleName}s/all:
 *   get:
 *     tags: [${modelName}s]
 *     summary: Get all ${moduleName}s without pagination (supports sorting and filtering)
 *     description: |
 *       **Available Filter Fields:**
 *       - ${filterFieldsDisplay}
 *       
 *       **Available Sort Fields:**
 *       - ${sortFieldsDisplay}
 *       
 *       **Filter Operators:**
 *       - Exact: \`filter[field]=value\`
 *       - Greater/Equal: \`filter[field][gte]=value\`
 *       - Less/Equal: \`filter[field][lte]=value\`
 *       - Greater: \`filter[field][gt]=value\`
 *       - Less: \`filter[field][lt]=value\`
 *       - Contains: \`filter[field][like]=value\`
 *       - In list: \`filter[field][in]=1,2,3\`
 *       
 *       **Example Routes:**
 *       \`\`\`
 *       GET /api/${moduleName}s/all
 *       GET /api/${moduleName}s/all?sortBy=${sortFields[0]}&sortOrder=asc
 *       GET /api/${moduleName}s/all?filter[field]=value
 * 
 *       \`\`\`
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [${sortFieldsStr}]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: All ${moduleName}s
 */
router.get(
  '/all',
  sort([${sortFieldsStr}]),
  filter([${filterFieldsStr}]),
  getAll
);

/**
 * @swagger
 * /api/${moduleName}s/{id}:
 *   get:
 *     tags: [${modelName}s]
 *     summary: Get ${moduleName} by ID
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
 *         description: ${modelName} details
 *       404:
 *         description: ${modelName} not found
 */
router.get('/:id', validate(idParamSchema, 'params'), getById);

/**
 * @swagger
 * /api/${moduleName}s:
 *   post:
 *     tags: [${modelName}s]
 *     summary: Create a new ${moduleName}
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             ${createSchemaStr}
 *     responses:
 *       201:
 *         description: ${modelName} created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', validate(create${modelName}Schema), create);

/**
 * @swagger
 * /api/${moduleName}s/{id}:
 *   put:
 *     tags: [${modelName}s]
 *     summary: Update a ${moduleName}
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
 *             ${updateSchemaStr}
 *     responses:
 *       200:
 *         description: ${modelName} updated successfully
 *       404:
 *         description: ${modelName} not found
 */
router.put('/:id', validate(idParamSchema, 'params'), validate(update${modelName}Schema), update);

/**
 * @swagger
 * /api/${moduleName}s/{id}:
 *   delete:
 *     tags: [${modelName}s]
 *     summary: Delete a ${moduleName}
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
 *         description: ${modelName} deleted successfully
 *       404:
 *         description: ${modelName} not found
 */
router.delete('/:id', validate(idParamSchema, 'params'), deleteItem);

export default router;
`;

// Write module files
fs.writeFileSync(path.join(modulePath, 'manager.js'), managerContent);
console.log(`✅ Manager created: src/modules/${moduleName}/manager.js`);

fs.writeFileSync(path.join(modulePath, 'controller.js'), controllerContent);
console.log(`✅ Controller created: src/modules/${moduleName}/controller.js`);

fs.writeFileSync(path.join(modulePath, 'validation.js'), validationContent);
console.log(`✅ Validation created: src/modules/${moduleName}/validation.js`);

fs.writeFileSync(path.join(modulePath, 'routes.js'), routesContent);
console.log(`✅ Routes created: src/modules/${moduleName}/routes.js`);

// Update models/index.js
const modelsIndexPath = path.join(__dirname, 'models', 'index.js');
const modelsIndexContent = fs.readFileSync(modelsIndexPath, 'utf8');

if (!modelsIndexContent.includes(`import ${modelName}`)) {
  const importLine = `import ${modelName} from './${modelName}.js';`;
  const updatedContent = modelsIndexContent
    .replace(/(import User from '\.\/User\.js';)/, `$1\n${importLine}`)
    .replace(/(const db = {[\s\S]*?User)/m, `$1,\n  ${modelName}`);
  
  fs.writeFileSync(modelsIndexPath, updatedContent);
  console.log(`✅ Updated: database/models/index.js`);
}

// Update routes/index.js
const routesIndexPath = path.join(__dirname, '..', 'src', 'routes', 'index.js');
const routesIndexContent = fs.readFileSync(routesIndexPath, 'utf8');

if (!routesIndexContent.includes(`import ${moduleName}Routes`)) {
  const importLine = `import ${moduleName}Routes from '../modules/${moduleName}/routes.js';`;
  const routeLine = `router.use('/${moduleName}s', ${moduleName}Routes);`;
  
  const updatedRoutesContent = routesIndexContent
    .replace(/(import authRoutes from '\.\.\/modules\/auth\/routes\.js';)/, `$1\n${importLine}`)
    .replace(/(router\.use\('\/auth', authRoutes\);)/, `$1\n${routeLine}`);
  
  fs.writeFileSync(routesIndexPath, updatedRoutesContent);
  console.log(`✅ Updated: src/routes/index.js`);
}

console.log('\n📝 Next steps:');
console.log('1. Run: npm run db:migrate');
console.log('2. Start server: npm run dev');

