const path = require('path');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',

  db: {
    path: process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'todo.db'),
    testPath: path.join(__dirname, '..', '..', 'data', 'todo-test.db'),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};

module.exports = config;
