const { getConnection } = require('./connection');

const MIGRATIONS = [
  {
    version: 1,
    name: 'create_todos_table',
    up: `
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        completed INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
        due_date TEXT,
        tags TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
      CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
      CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
      CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
    `,
  },
  {
    version: 2,
    name: 'create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 3,
    name: 'add_scheduled_at',
    up: `
      ALTER TABLE todos ADD COLUMN scheduled_at TEXT;

      CREATE INDEX IF NOT EXISTS idx_todos_scheduled_at ON todos(scheduled_at);
    `,
  },
];

function runMigrations() {
  const db = getConnection();

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedMigrations = db
    .prepare('SELECT version FROM migrations')
    .all()
    .map((row) => row.version);

  const pendingMigrations = MIGRATIONS.filter(
    (m) => !appliedMigrations.includes(m.version),
  );

  if (pendingMigrations.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  const runAll = db.transaction(() => {
    for (const migration of pendingMigrations) {
      console.log(`Running migration ${migration.version}: ${migration.name}`);
      db.exec(migration.up);
      db.prepare('INSERT OR IGNORE INTO migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name,
      );
    }
  });

  runAll();
  console.log(`Applied ${pendingMigrations.length} migration(s).`);
}

module.exports = { runMigrations };
