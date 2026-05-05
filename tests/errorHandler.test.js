const path = require('path');
const express = require('express');
const request = require('supertest');
const { notFoundHandler, globalErrorHandler } = require('../src/middleware/errorHandler');

function buildApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'src', 'views'));
  app.use(express.json());

  app.get('/api/ok', (_req, res) => res.json({ success: true }));

  app.get('/throw-default', (_req, _res, next) => {
    next(new Error('boom default'));
  });

  app.get('/throw-custom', (_req, _res, next) => {
    const err = new Error('boom custom');
    err.statusCode = 418;
    err.code = 'TEAPOT';
    next(err);
  });

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

describe('notFoundHandler', () => {
  let app;
  beforeAll(() => {
    app = buildApp();
  });

  test('returns JSON 404 for /api/* paths with the request method and path', async () => {
    const res = await request(app).get('/api/missing');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/missing not found',
      },
    });
  });

  test('uses the actual HTTP method in the error message', async () => {
    const res = await request(app).post('/api/some-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Route POST /api/some-endpoint not found');
  });

  test('renders the error EJS view for non-API paths', async () => {
    const res = await request(app).get('/some-page');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('404');
    expect(res.text).toContain('The page you are looking for does not exist');
  });

  test('does not interfere with successful routes', async () => {
    const res = await request(app).get('/api/ok');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

describe('globalErrorHandler', () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  test('returns 500 with INTERNAL_ERROR code by default', async () => {
    process.env.NODE_ENV = 'development';
    const app = buildApp();

    const res = await request(app).get('/throw-default');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('boom default');
  });

  test('includes the stack trace outside of production', async () => {
    process.env.NODE_ENV = 'development';
    const app = buildApp();

    const res = await request(app).get('/throw-default');

    expect(res.body.error.stack).toBeDefined();
    expect(typeof res.body.error.stack).toBe('string');
  });

  test('uses custom statusCode and code from the error object', async () => {
    process.env.NODE_ENV = 'development';
    const app = buildApp();

    const res = await request(app).get('/throw-custom');

    expect(res.status).toBe(418);
    expect(res.body.error.code).toBe('TEAPOT');
    expect(res.body.error.message).toBe('boom custom');
  });

  test('hides message and stack when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp();

    const res = await request(app).get('/throw-default');

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal Server Error');
    expect(res.body.error.stack).toBeUndefined();
  });

  test('logs the error via console.error', async () => {
    process.env.NODE_ENV = 'development';
    const app = buildApp();

    await request(app).get('/throw-default');

    expect(consoleErrorSpy).toHaveBeenCalled();
    const firstArg = consoleErrorSpy.mock.calls[0][0];
    expect(firstArg).toBe('Unhandled error:');
  });
});
