const { getConnection, closeConnection } = require('./connection');
const { runMigrations } = require('./migrate');

function initializeDatabase() {
  try {
    console.log('Initializing database...');
    getConnection();
    runMigrations();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    throw error;
  }
}

if (require.main === module) {
  initializeDatabase();
  closeConnection();
  console.log('Done.');
}

module.exports = { initializeDatabase };
