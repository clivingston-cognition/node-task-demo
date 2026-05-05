const app = require('./app');
const config = require('./config');
const { closeConnection } = require('./db/connection');

const server = app.listen(config.port, config.host, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║        Task Manager App - Running!        ║
  ╠═══════════════════════════════════════════╣
  ║  Environment : ${config.env.padEnd(25)} ║
  ║  Server      : http://${config.host}:${config.port}${' '.repeat(Math.max(0, 16 - `${config.host}:${config.port}`.length))} ║
  ║  API Base    : /api/todos${' '.repeat(16)} ║
  ╚═══════════════════════════════════════════╝
  `);
});

function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    closeConnection();
    console.log('Server closed. Database connection released.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
