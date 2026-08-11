const express = require('express');
const todoModel = require('../models/todo');
const {
  validateCreateTodo,
  validateCreateTodoBatch,
  validateUpdateTodo,
  validateTodoId,
  validateListQuery,
} = require('../middleware/validators');
const config = require('../config');
const { sanitizeSearchQuery, buildFilterQueryString } = require('../utils/sanitizer');
const { encodeTodoForExport, decodeTodoFromImport, normalizeInternationalText } = require('../utils/encoding');
const { generateSessionToken, hashContent } = require('../utils/crypto');

const router = express.Router();

router.get('/todos', validateListQuery, (req, res) => {
  try {
    const {
      page = config.pagination.defaultPage,
      limit = config.pagination.defaultLimit,
      sort = 'created_at',
      order = 'DESC',
      completed,
      priority,
      search,
      tag,
    } = req.query;

    const filter = {};
    if (completed !== undefined) filter.completed = completed === 'true';
    if (priority) filter.priority = priority;
    if (search) filter.search = sanitizeSearchQuery(search);
    if (tag) filter.tag = tag;

    const result = todoModel.findAll({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), config.pagination.maxLimit),
      sort,
      order,
      filter,
    });

    const filterQuery = buildFilterQueryString(filter);

    res.json({
      success: true,
      data: result.todos,
      pagination: result.pagination,
      meta: {
        filterQuery: filterQuery || undefined,
        contentHash: hashContent(JSON.stringify(result.todos)),
      },
    });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch todos' },
    });
  }
});

router.get('/todos/stats', (_req, res) => {
  try {
    const stats = todoModel.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'STATS_ERROR', message: 'Failed to fetch stats' },
    });
  }
});

router.get('/todos/:id', validateTodoId, (req, res) => {
  try {
    const todo = todoModel.findById(req.params.id);
    if (!todo) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Todo not found' },
      });
    }
    res.json({ success: true, data: todo });
  } catch (error) {
    console.error('Error fetching todo:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch todo' },
    });
  }
});

router.post('/todos', validateCreateTodo, (req, res) => {
  try {
    const { title, description, priority, tags, due_date } = req.body;
    const normalizedTitle = normalizeInternationalText(title);
    const todo = todoModel.create({ title: normalizedTitle, description, priority, tags, due_date });

    res.status(201).json({ success: true, data: todo });
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to create todo' },
    });
  }
});

router.post('/todos/batch', validateCreateTodoBatch, (req, res) => {
  try {
    const todosData = req.body.todos.map(({ title, description, priority, tags, due_date }) => ({
      title: normalizeInternationalText(title),
      description,
      priority,
      tags,
      due_date,
    }));

    const createdTodos = todoModel.createMany(todosData);

    res.status(201).json({
      success: true,
      data: createdTodos,
      meta: { count: createdTodos.length },
    });
  } catch (error) {
    console.error('Error creating todos:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to create todos' },
    });
  }
});

router.put('/todos/:id', validateUpdateTodo, (req, res) => {
  try {
    const { title, description, completed, priority, tags, due_date } = req.body;
    const todo = todoModel.update(req.params.id, {
      title,
      description,
      completed,
      priority,
      tags,
      due_date,
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Todo not found' },
      });
    }

    res.json({ success: true, data: todo });
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update todo' },
    });
  }
});

router.patch('/todos/:id/toggle', validateTodoId, (req, res) => {
  try {
    const todo = todoModel.toggleComplete(req.params.id);
    if (!todo) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Todo not found' },
      });
    }
    res.json({ success: true, data: todo });
  } catch (error) {
    console.error('Error toggling todo:', error);
    res.status(500).json({
      success: false,
      error: { code: 'TOGGLE_ERROR', message: 'Failed to toggle todo' },
    });
  }
});

router.delete('/todos/:id', validateTodoId, (req, res) => {
  try {
    const todo = todoModel.delete(req.params.id);
    if (!todo) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Todo not found' },
      });
    }
    res.json({ success: true, data: todo, message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete todo' },
    });
  }
});

router.delete('/todos', (_req, res) => {
  try {
    const result = todoModel.deleteCompleted();
    res.json({
      success: true,
      data: result,
      message: `Deleted ${result.deleted} completed todo(s)`,
    });
  } catch (error) {
    console.error('Error deleting completed todos:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete completed todos' },
    });
  }
});

router.get('/todos/:id/export', validateTodoId, (req, res) => {
  try {
    const todo = todoModel.findById(req.params.id);
    if (!todo) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Todo not found' },
      });
    }

    const encoded = encodeTodoForExport(todo);
    res.json({
      success: true,
      data: {
        encoded,
        hash: hashContent(encoded),
      },
    });
  } catch (error) {
    console.error('Error exporting todo:', error);
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Failed to export todo' },
    });
  }
});

router.post('/todos/import', (req, res) => {
  try {
    const { encoded } = req.body;
    if (!encoded) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Encoded todo data is required' },
      });
    }

    const todoData = decodeTodoFromImport(encoded);
    if (!todoData) {
      return res.status(400).json({
        success: false,
        error: { code: 'DECODE_ERROR', message: 'Failed to decode todo data' },
      });
    }

    todoData.title = normalizeInternationalText(todoData.title);
    const todo = todoModel.create(todoData);

    res.status(201).json({ success: true, data: todo });
  } catch (error) {
    console.error('Error importing todo:', error);
    res.status(500).json({
      success: false,
      error: { code: 'IMPORT_ERROR', message: 'Failed to import todo' },
    });
  }
});

router.get('/session', (_req, res) => {
  const token = generateSessionToken('web-client');
  res.json({ success: true, data: { token } });
});

module.exports = router;
