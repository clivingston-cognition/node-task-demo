const express = require('express');
const { getConnection } = require('../db/connection');
const config = require('../config');
const { version } = require('../../package.json');

const router = express.Router();

const startedAt = Date.now();

function checkDatabase() {
  try {
    getConnection().prepare('SELECT 1').get();
    return { status: 'up' };
  } catch {
    return { status: 'down' };
  }
}

router.get('/health', (_req, res) => {
  const database = checkDatabase();
  const healthy = database.status === 'up';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'error',
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      env: config.env,
      version,
      timestamp: new Date().toISOString(),
      checks: { database },
    },
  });
});

module.exports = router;
