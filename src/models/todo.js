const { v4: uuidv4 } = require('uuid');
const { getConnection } = require('../db/connection');

class TodoModel {
  constructor() {
    this.tableName = 'todos';
  }

  _getDb() {
    return getConnection();
  }

  _parseTodo(row) {
    if (!row) return null;
    return {
      ...row,
      completed: Boolean(row.completed),
      tags: JSON.parse(row.tags || '[]'),
    };
  }

  // Builds a safe ORDER BY clause. Both arguments are pre-validated against
  // fixed allowlists by the caller, so no user input reaches the SQL string.
  _buildOrderClause(safeSort, safeOrder) {
    if (safeSort === 'urgency') {
      // Most urgent first: incomplete before completed, then by priority
      // weight, then by soonest scheduled time (nulls last).
      return [
        'completed ASC',
        "CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC",
        'scheduled_at IS NULL ASC',
        'scheduled_at ASC',
      ].join(', ');
    }

    if (safeSort === 'scheduled_at') {
      // Keep todos without a scheduled time at the end regardless of order.
      return `scheduled_at IS NULL ASC, scheduled_at ${safeOrder}`;
    }

    return `${safeSort} ${safeOrder}`;
  }

  findAll({ page = 1, limit = 20, sort = 'created_at', order = 'DESC', filter = {} } = {}) {
    const db = this._getDb();
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];

    if (filter.completed !== undefined) {
      whereClause += ' AND completed = ?';
      params.push(filter.completed ? 1 : 0);
    }

    if (filter.priority) {
      whereClause += ' AND priority = ?';
      params.push(filter.priority);
    }

    if (filter.search) {
      whereClause += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }

    if (filter.tag) {
      whereClause += ' AND tags LIKE ?';
      params.push(`%"${filter.tag}"%`);
    }

    const allowedSorts = ['created_at', 'updated_at', 'title', 'priority', 'due_date', 'scheduled_at', 'urgency'];
    const safeSort = allowedSorts.includes(sort) ? sort : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderClause = this._buildOrderClause(safeSort, safeOrder);

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}`);
    const { total } = countStmt.get(...params);

    const selectStmt = db.prepare(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`,
    );
    const rows = selectStmt.all(...params, limit, offset);

    return {
      todos: rows.map((row) => this._parseTodo(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  findById(id) {
    const db = this._getDb();
    const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id);
    return this._parseTodo(row);
  }

  create({ title, description = '', priority = 'medium', tags = [], due_date = null, scheduled_at = null }) {
    const db = this._getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO ${this.tableName} (id, title, description, completed, priority, tags, due_date, scheduled_at, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, title, description, priority, JSON.stringify(tags), due_date, scheduled_at, now, now);
    return this.findById(id);
  }

  update(id, updates) {
    const db = this._getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const allowedFields = ['title', 'description', 'completed', 'priority', 'tags', 'due_date', 'scheduled_at'];
    const setClauses = [];
    const params = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        if (field === 'completed') {
          params.push(updates[field] ? 1 : 0);
        } else if (field === 'tags') {
          params.push(JSON.stringify(updates[field]));
        } else {
          params.push(updates[field]);
        }
      }
    }

    if (setClauses.length === 0) return existing;

    setClauses.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const stmt = db.prepare(
      `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE id = ?`,
    );
    stmt.run(...params);

    return this.findById(id);
  }

  delete(id) {
    const db = this._getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const stmt = db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    stmt.run(id);
    return existing;
  }

  toggleComplete(id) {
    const db = this._getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const newCompleted = existing.completed ? 0 : 1;
    const stmt = db.prepare(
      `UPDATE ${this.tableName} SET completed = ?, updated_at = ? WHERE id = ?`,
    );
    stmt.run(newCompleted, new Date().toISOString(), id);

    return this.findById(id);
  }

  getStats() {
    const db = this._getDb();

    const total = db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get().count;
    const completed = db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE completed = 1`).get().count;
    const pending = total - completed;

    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count FROM ${this.tableName} GROUP BY priority
    `).all();

    const overdue = db.prepare(`
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE due_date IS NOT NULL AND due_date < datetime('now') AND completed = 0
    `).get().count;

    return {
      total,
      completed,
      pending,
      overdue,
      byPriority: byPriority.reduce((acc, row) => {
        acc[row.priority] = row.count;
        return acc;
      }, {}),
    };
  }

  deleteCompleted() {
    const db = this._getDb();
    const stmt = db.prepare(`DELETE FROM ${this.tableName} WHERE completed = 1`);
    const result = stmt.run();
    return { deleted: result.changes };
  }
}

module.exports = new TodoModel();
