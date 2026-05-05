const fs = require('fs');
const { getDbPath, closeConnection } = require('./connection');
const { seedDatabase } = require('./seed');

function resetDatabase() {
  closeConnection();

  const dbPath = getDbPath();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`Deleted database at ${dbPath}`);
  }

  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  seedDatabase();
  console.log('Database reset complete.');
}

if (require.main === module) {
  resetDatabase();
  closeConnection();
  console.log('Done.');
}

module.exports = { resetDatabase };
