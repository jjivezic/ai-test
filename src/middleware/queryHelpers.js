import { Op } from 'sequelize';

/**
 * Pagination middleware
 * Adds pagination parameters to req.pagination
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 */
export const paginate = (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const offset = (page - 1) * limit;

  req.pagination = {
    page,
    limit,
    offset
  };

  next();
};

/**
 * Sorting middleware
 * Adds sorting parameters to req.sort
 *
 * Query params:
 * - sortBy: Field to sort by (default: 'created_at')
 * - sortOrder: 'asc' or 'desc' (default: 'desc')
 */
export const sort = (allowedFields = ['created_at'], fieldMapping = {}) => {
  return (req, res, next) => {
    let sortBy = req.query.sortBy || 'created_at';
    const sortOrder = (req.query.sortOrder || 'desc').toLowerCase();

    // Map camelCase to snake_case if mapping provided
    if (fieldMapping[sortBy]) {
      sortBy = fieldMapping[sortBy];
    }
    // Validate sortBy field
    if (!allowedFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sort field. Allowed: ${allowedFields.join(', ')}`
      });
    }

    // Validate sortOrder
    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sort order. Use "asc" or "desc"'
      });
    }

    req.sort = {
      field: sortBy,
      order: sortOrder.toUpperCase()
    };

    next();
  };
};

/**
 * Filtering middleware
 * Adds filtering parameters to req.filters
 *
 * Query params examples:
 * - filter[name]=John
 * - filter[age][gte]=18
 * - filter[status]=active
 */
export const filter = (allowedFields = []) => {
  return (req, res, next) => {
    const filters = {};

    if (req.query.filter) {
      Object.keys(req.query.filter).forEach((field) => {
        // Validate field
        if (allowedFields.length > 0 && !allowedFields.includes(field)) {
          return;
        }

        const value = req.query.filter[field];

        // Handle operators (gte, lte, gt, lt, like)
        if (typeof value === 'object') {
          const operators = {
            gte: Op.gte,
            lte: Op.lte,
            gt: Op.gt,
            lt: Op.lt,
            like: Op.like,
            in: Op.in
          };

          filters[field] = {};
          Object.keys(value).forEach((op) => {
            if (operators[op]) {
              if (op === 'like') {
                filters[field][operators[op]] = `%${value[op]}%`;
              } else if (op === 'in') {
                filters[field][operators[op]] = value[op].split(',');
              } else {
                filters[field][operators[op]] = value[op];
              }
            }
          });
        } else {
          // Simple equality
          filters[field] = value;
        }
      });
    }

    req.filters = filters;
    next();
  };
};
