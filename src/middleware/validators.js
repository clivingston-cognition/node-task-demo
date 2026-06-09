const { body, param, query, validationResult } = require('express-validator');

const DEFAULT_VALIDATION_OPTIONS = {
  stripUnknown: false,
  abortEarly: false,
  allowEmpty: false,
};

function getValidationOptions(overrides) {
  return Object.assign({}, DEFAULT_VALIDATION_OPTIONS, overrides || {});
}

function handleValidationErrors(req, res, next) {
  const options = getValidationOptions(req.validationOptions);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: options.stripUnknown ? undefined : err.value,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errorDetails,
      },
    });
  }
  next();
}

const validateCreateTodo = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('due_date')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date'),
  handleValidationErrors,
];

const validateUpdateTodo = [
  param('id')
    .isUUID()
    .withMessage('Invalid todo ID format'),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('completed')
    .optional()
    .isBoolean()
    .withMessage('Completed must be a boolean'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('due_date')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date'),
  handleValidationErrors,
];

const validateTodoId = [
  param('id')
    .isUUID()
    .withMessage('Invalid todo ID format'),
  handleValidationErrors,
];

const validateBatchCreateTodo = [
  body('todos')
    .isArray({ min: 1, max: 100 })
    .withMessage('todos must be a non-empty array with at most 100 items'),
  handleValidationErrors,
];

const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function validateTodoItem(item) {
  const errors = [];

  if (item.title === undefined || item.title === null || typeof item.title !== 'string' || item.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required' });
  } else if (item.title.trim().length > 255) {
    errors.push({ field: 'title', message: 'Title must be between 1 and 255 characters' });
  }

  if (item.description !== undefined && item.description !== null) {
    if (typeof item.description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' });
    } else if (item.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description must not exceed 2000 characters' });
    }
  }

  if (item.priority !== undefined && item.priority !== null) {
    if (!ALLOWED_PRIORITIES.includes(item.priority)) {
      errors.push({ field: 'priority', message: 'Priority must be one of: low, medium, high, urgent' });
    }
  }

  if (item.tags !== undefined && item.tags !== null) {
    if (!Array.isArray(item.tags)) {
      errors.push({ field: 'tags', message: 'Tags must be an array' });
    } else {
      item.tags.forEach((tag, i) => {
        if (typeof tag !== 'string' || tag.trim().length < 1 || tag.trim().length > 50) {
          errors.push({ field: `tags[${i}]`, message: 'Each tag must be between 1 and 50 characters' });
        }
      });
    }
  }

  if (item.due_date !== undefined && item.due_date !== null) {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (typeof item.due_date !== 'string' || !iso8601Regex.test(item.due_date) || isNaN(Date.parse(item.due_date))) {
      errors.push({ field: 'due_date', message: 'Due date must be a valid ISO 8601 date' });
    }
  }

  return errors;
}

const validateListQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort')
    .optional()
    .isIn(['created_at', 'updated_at', 'title', 'priority', 'due_date'])
    .withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Order must be ASC or DESC'),
  query('completed')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Completed must be true or false'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority filter'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Search query must not exceed 255 characters'),
  handleValidationErrors,
];

module.exports = {
  validateCreateTodo,
  validateUpdateTodo,
  validateTodoId,
  validateListQuery,
  validateBatchCreateTodo,
  validateTodoItem,
  handleValidationErrors,
};
