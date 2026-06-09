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

describe('POST /api/todos/batch - Batch Create', () => {
  test('should create multiple valid todos successfully', async () => {
    const res = await request(app)
      .post('/api/todos/batch')
      .send({
        todos: [
          { title: 'Batch todo 1', priority: 'high' },
          { title: 'Batch todo 2', description: 'Second item', tags: ['work'] },
          { title: 'Batch todo 3', priority: 'low', due_date: '2026-12-31' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toHaveLength(3);
    expect(res.body.data.failed).toHaveLength(0);
    expect(res.body.data.totalReceived).toBe(3);
    expect(res.body.data.totalCreated).toBe(3);
    expect(res.body.data.totalFailed).toBe(0);

    expect(res.body.data.created[0]).toMatchObject({ title: 'Batch todo 1', priority: 'high' });
    expect(res.body.data.created[1]).toMatchObject({ title: 'Batch todo 2', tags: ['work'] });
    expect(res.body.data.created[2]).toMatchObject({ title: 'Batch todo 3', due_date: '2026-12-31' });

    for (const todo of res.body.data.created) {
      expect(todo.id).toBeDefined();
      expect(todo.created_at).toBeDefined();
    }
  });

  test('should handle partial success with mix of valid and invalid todos', async () => {
    const res = await request(app)
      .post('/api/todos/batch')
      .send({
        todos: [
          { title: 'Valid todo' },
          { title: '' },
          { title: 'Another valid', priority: 'urgent' },
          { title: 'Bad priority', priority: 'invalid' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toHaveLength(2);
    expect(res.body.data.failed).toHaveLength(2);
    expect(res.body.data.totalReceived).toBe(4);
    expect(res.body.data.totalCreated).toBe(2);
    expect(res.body.data.totalFailed).toBe(2);

    expect(res.body.data.failed[0].index).toBe(1);
    expect(res.body.data.failed[0].errors.length).toBeGreaterThan(0);
    expect(res.body.data.failed[1].index).toBe(3);
    expect(res.body.data.failed[1].errors).toContain('Priority must be one of: low, medium, high, urgent');
  });

  test('should return 400 when all items are invalid', async () => {
    const res = await request(app)
      .post('/api/todos/batch')
      .send({
        todos: [
          { title: '' },
          { description: 'No title here' },
          { title: 'x'.repeat(256) },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.data.created).toHaveLength(0);
    expect(res.body.data.failed).toHaveLength(3);
    expect(res.body.data.totalCreated).toBe(0);
    expect(res.body.data.totalFailed).toBe(3);
  });

  test('should return 400 when todos is not an array', async () => {
    const res = await request(app)
      .post('/api/todos/batch')
      .send({ todos: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 when todos is an empty array', async () => {
    const res = await request(app)
      .post('/api/todos/batch')
      .send({ todos: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 when todos exceeds 100 items', async () => {
    const todos = Array.from({ length: 101 }, (_, i) => ({ title: `Todo ${i}` }));

    const res = await request(app)
      .post('/api/todos/batch')
      .send({ todos });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should verify created todos exist in DB after partial success', async () => {
    const res = await request(app)
      .post('/api/todos/batch')
      .send({
        todos: [
          { title: 'DB verify todo 1', priority: 'high' },
          { title: '' },
          { title: 'DB verify todo 2', tags: ['verify'] },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.created).toHaveLength(2);

    for (const created of res.body.data.created) {
      const getRes = await request(app).get(`/api/todos/${created.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(created.id);
      expect(getRes.body.data.title).toBe(created.title);
    }
  });
});
