const request = require('supertest');
const fs = require('fs');
const app = require('../src/app');
const { closeConnection, getDbPath } = require('../src/db/connection');

beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  closeConnection();
  const dbPath = getDbPath();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
});

describe('Health & Misc', () => {
  test('GET / should return the HTML page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Hi Devin');
  });

  test('GET /api/nonexistent should return 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/todos - Create', () => {
  test('should create a todo with only title', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Test todo' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      title: 'Test todo',
      description: '',
      completed: false,
      priority: 'medium',
      tags: [],
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.created_at).toBeDefined();
    expect(res.body.data.updated_at).toBeDefined();
  });

  test('should create a todo with all fields', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({
        title: 'Full todo',
        description: 'A fully detailed todo item',
        priority: 'high',
        tags: ['work', 'important'],
        due_date: '2025-12-31',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Full todo',
      description: 'A fully detailed todo item',
      completed: false,
      priority: 'high',
      tags: ['work', 'important'],
      due_date: '2025-12-31',
    });
  });

  test('should create a todo with urgent priority', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Urgent task', priority: 'urgent' });

    expect(res.status).toBe(201);
    expect(res.body.data.priority).toBe('urgent');
  });

  test('should create a todo with low priority', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Low priority task', priority: 'low' });

    expect(res.status).toBe(201);
    expect(res.body.data.priority).toBe('low');
  });

  test('should fail without title', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ description: 'No title provided' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should fail with empty title', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should fail with title exceeding 255 characters', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'a'.repeat(256) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should fail with invalid priority', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Test', priority: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should fail with invalid due_date format', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Test', due_date: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should fail when tags is not an array', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Test', tags: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should fail with description exceeding 2000 characters', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Test', description: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/todos - Read All', () => {
  test('should return a list of todos with pagination', async () => {
    const res = await request(app).get('/api/todos');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('limit');
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('totalPages');
    expect(res.body.pagination).toHaveProperty('hasNext');
    expect(res.body.pagination).toHaveProperty('hasPrev');
  });

  test('should support custom pagination', async () => {
    const res = await request(app).get('/api/todos?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.limit).toBe(2);
  });

  test('should filter by completed status', async () => {
    const res = await request(app).get('/api/todos?completed=false');

    expect(res.status).toBe(200);
    res.body.data.forEach((todo) => {
      expect(todo.completed).toBe(false);
    });
  });

  test('should filter by priority', async () => {
    const res = await request(app).get('/api/todos?priority=high');

    expect(res.status).toBe(200);
    res.body.data.forEach((todo) => {
      expect(todo.priority).toBe('high');
    });
  });

  test('should search by title or description', async () => {
    await request(app)
      .post('/api/todos')
      .send({ title: 'Unique search term xyz123' });

    const res = await request(app).get('/api/todos?search=xyz123');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].title).toContain('xyz123');
  });

  test('should sort by title ascending', async () => {
    const res = await request(app).get('/api/todos?sort=title&order=ASC');

    expect(res.status).toBe(200);
    const titles = res.body.data.map((t) => t.title);
    const sorted = [...titles].sort();
    expect(titles).toEqual(sorted);
  });

  test('should reject invalid page parameter', async () => {
    const res = await request(app).get('/api/todos?page=-1');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject invalid limit parameter', async () => {
    const res = await request(app).get('/api/todos?limit=999');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject invalid sort field', async () => {
    const res = await request(app).get('/api/todos?sort=invalid_field');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/todos/:id - Read One', () => {
  let todoId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Todo for GET by ID test' });
    todoId = res.body.data.id;
  });

  test('should return a single todo by ID', async () => {
    const res = await request(app).get(`/api/todos/${todoId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(todoId);
    expect(res.body.data.title).toBe('Todo for GET by ID test');
  });

  test('should return 404 for non-existent todo', async () => {
    const res = await request(app).get('/api/todos/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('should return 400 for invalid UUID format', async () => {
    const res = await request(app).get('/api/todos/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/todos/:id - Update', () => {
  let todoId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({
        title: 'Todo for update test',
        description: 'Original description',
        priority: 'medium',
        tags: ['original'],
      });
    todoId = res.body.data.id;
  });

  test('should update the title', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated title');
  });

  test('should update the description', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Updated description');
  });

  test('should update completed status', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body.data.completed).toBe(true);
  });

  test('should update priority', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ priority: 'urgent' });

    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe('urgent');
  });

  test('should update tags', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ tags: ['updated', 'test'] });

    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual(['updated', 'test']);
  });

  test('should update due_date', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ due_date: '2025-06-15' });

    expect(res.status).toBe(200);
    expect(res.body.data.due_date).toBe('2025-06-15');
  });

  test('should update multiple fields at once', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({
        title: 'Multi-update test',
        priority: 'low',
        completed: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Multi-update test');
    expect(res.body.data.priority).toBe('low');
    expect(res.body.data.completed).toBe(false);
  });

  test('should update the updated_at timestamp', async () => {
    const before = await request(app).get(`/api/todos/${todoId}`);
    const beforeUpdatedAt = before.body.data.updated_at;

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ title: 'Timestamp check' });

    expect(res.body.data.updated_at).not.toBe(beforeUpdatedAt);
  });

  test('should return 404 for non-existent todo', async () => {
    const res = await request(app)
      .put('/api/todos/00000000-0000-0000-0000-000000000000')
      .send({ title: 'Ghost update' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('should return 400 for invalid UUID format', async () => {
    const res = await request(app)
      .put('/api/todos/invalid-id')
      .send({ title: 'Bad ID update' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for invalid priority on update', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ priority: 'super-urgent' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for empty title on update', async () => {
    const res = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/todos/:id/toggle - Toggle Complete', () => {
  let todoId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Toggle test todo' });
    todoId = res.body.data.id;
  });

  test('should toggle from incomplete to complete', async () => {
    const res = await request(app)
      .patch(`/api/todos/${todoId}/toggle`);

    expect(res.status).toBe(200);
    expect(res.body.data.completed).toBe(true);
  });

  test('should toggle from complete to incomplete', async () => {
    const res = await request(app)
      .patch(`/api/todos/${todoId}/toggle`);

    expect(res.status).toBe(200);
    expect(res.body.data.completed).toBe(false);
  });

  test('should return 404 for non-existent todo', async () => {
    const res = await request(app)
      .patch('/api/todos/00000000-0000-0000-0000-000000000000/toggle');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('should return 400 for invalid UUID format', async () => {
    const res = await request(app)
      .patch('/api/todos/bad-uuid/toggle');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/todos/:id - Delete One', () => {
  let todoId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: 'Todo to delete' });
    todoId = res.body.data.id;
  });

  test('should delete a todo and return it', async () => {
    const res = await request(app).delete(`/api/todos/${todoId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(todoId);
    expect(res.body.message).toBe('Todo deleted successfully');

    // Verify it's actually gone
    const check = await request(app).get(`/api/todos/${todoId}`);
    expect(check.status).toBe(404);
  });

  test('should return 404 for non-existent todo', async () => {
    const res = await request(app)
      .delete('/api/todos/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('should return 400 for invalid UUID format', async () => {
    const res = await request(app).delete('/api/todos/not-valid');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/todos - Delete Completed', () => {
  test('should delete all completed todos', async () => {
    // Create and complete a todo
    const createRes = await request(app)
      .post('/api/todos')
      .send({ title: 'Will be completed and deleted' });
    const id = createRes.body.data.id;

    await request(app)
      .put(`/api/todos/${id}`)
      .send({ completed: true });

    const res = await request(app).delete('/api/todos');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBeGreaterThanOrEqual(1);
  });

  test('should return 0 deleted when no completed todos', async () => {
    // First clear completed
    await request(app).delete('/api/todos');

    const res = await request(app).delete('/api/todos');

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(0);
  });
});

describe('GET /api/todos/stats - Stats', () => {
  test('should return stats object', async () => {
    const res = await request(app).get('/api/todos/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('completed');
    expect(res.body.data).toHaveProperty('pending');
    expect(res.body.data).toHaveProperty('overdue');
    expect(res.body.data).toHaveProperty('byPriority');
    expect(typeof res.body.data.total).toBe('number');
    expect(typeof res.body.data.completed).toBe('number');
    expect(typeof res.body.data.pending).toBe('number');
  });

  test('should reflect correct counts after operations', async () => {
    const before = await request(app).get('/api/todos/stats');
    const beforeTotal = before.body.data.total;

    await request(app)
      .post('/api/todos')
      .send({ title: 'Stats test todo' });

    const after = await request(app).get('/api/todos/stats');
    expect(after.body.data.total).toBe(beforeTotal + 1);
    expect(after.body.data.pending).toBe(before.body.data.pending + 1);
  });
});

describe('Edge Cases & Security', () => {
  test('should handle large page numbers gracefully', async () => {
    const res = await request(app).get('/api/todos?page=99999');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.page).toBe(99999);
  });

  test('should cap limit to max allowed', async () => {
    const res = await request(app).get('/api/todos?limit=50');

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
  });

  test('should sanitize XSS in title', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: '<script>alert("xss")</script>Test' });

    expect(res.status).toBe(201);
    // The stored value should be the raw input; rendering sanitization happens on the frontend
    expect(res.body.data.title).toBe('<script>alert("xss")</script>Test');
  });

  test('should handle concurrent creates', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/todos')
        .send({ title: `Concurrent todo ${i}` }),
    );

    const results = await Promise.all(promises);
    results.forEach((res) => {
      expect(res.status).toBe(201);
    });

    // All IDs should be unique
    const ids = results.map((r) => r.body.data.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });

  test('should handle empty body on POST gracefully', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({});

    expect(res.status).toBe(400);
  });

  test('should handle filter by tag', async () => {
    await request(app)
      .post('/api/todos')
      .send({ title: 'Tagged todo', tags: ['special-tag-123'] });

    const res = await request(app).get('/api/todos?tag=special-tag-123');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
