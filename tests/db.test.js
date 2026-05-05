const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Build an isolated CommonJS context for the db modules with a unique
 * SQLite path. We use jest.isolateModules so each call gets a fresh
 * module cache (and therefore a fresh `db` singleton in connection.js).
 */
function withIsolatedDb(dbPath, fn) {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDbPath = process.env.DB_PATH;

  // Force getDbPath() to use config.db.path (which honors DB_PATH).
  process.env.NODE_ENV = 'development';
  process.env.DB_PATH = dbPath;

  try {
    jest.isolateModules(() => {
      // Silence the chatty migration / init logs that get emitted during tests.
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const connection = require('../src/db/connection');
        const init = require('../src/db/init');
        const migrate = require('../src/db/migrate');
        try {
          fn({ connection, init, migrate });
        } finally {
          // Best-effort cleanup of the singleton inside the isolated context.
          try {
            connection.closeConnection();
          } catch {
            /* ignore */
          }
        }
      } finally {
        logSpy.mockRestore();
      }
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = previousDbPath;
    }
  }
}

describe('db/connection.js', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-conn-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates parent directories when they do not yet exist', () => {
    const dbPath = path.join(tmpDir, 'nested', 'deep', 'data.db');

    withIsolatedDb(dbPath, ({ connection }) => {
      const db = connection.getConnection();
      expect(db).toBeDefined();
      expect(fs.existsSync(path.dirname(dbPath))).toBe(true);
      expect(fs.existsSync(dbPath)).toBe(true);
    });
  });

  test('returns the same connection on subsequent calls', () => {
    const dbPath = path.join(tmpDir, 'singleton.db');

    withIsolatedDb(dbPath, ({ connection }) => {
      const a = connection.getConnection();
      const b = connection.getConnection();
      expect(a).toBe(b);
    });
  });

  test('resetConnection closes and reopens the database', () => {
    const dbPath = path.join(tmpDir, 'reset.db');

    withIsolatedDb(dbPath, ({ connection }) => {
      const original = connection.getConnection();
      const reopened = connection.resetConnection();

      expect(reopened).toBeDefined();
      // The original handle should be closed after reset.
      expect(() => original.prepare('SELECT 1').get()).toThrow();
    });
  });

  test('closeConnection is idempotent', () => {
    const dbPath = path.join(tmpDir, 'idempotent.db');

    withIsolatedDb(dbPath, ({ connection }) => {
      connection.getConnection();
      connection.closeConnection();
      expect(() => connection.closeConnection()).not.toThrow();
    });
  });

  test('throws when an existing database file is not readable', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      // chmod 0o000 has no effect for root or on Windows.
      return;
    }

    const dbPath = path.join(tmpDir, 'unreadable.db');
    fs.writeFileSync(dbPath, '');
    fs.chmodSync(dbPath, 0o000);

    try {
      withIsolatedDb(dbPath, ({ connection }) => {
        expect(() => connection.getConnection()).toThrow(/not readable/);
      });
    } finally {
      // Restore permissions so the tmp directory can be cleaned up.
      fs.chmodSync(dbPath, 0o644);
    }
  });

  test('getDbPath returns the testPath when NODE_ENV=test', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    try {
      jest.isolateModules(() => {
        const { getDbPath } = require('../src/db/connection');
        expect(getDbPath()).toMatch(/todo-test\.db$/);
      });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

describe('db/init.js', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-init-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('initializeDatabase creates the schema', () => {
    const dbPath = path.join(tmpDir, 'init.db');

    withIsolatedDb(dbPath, ({ init, connection }) => {
      init.initializeDatabase();

      const db = connection.getConnection();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r) => r.name);
      expect(tables).toEqual(expect.arrayContaining(['todos', 'migrations']));
    });
  });

  test('initializeDatabase is idempotent', () => {
    const dbPath = path.join(tmpDir, 'init-idem.db');

    withIsolatedDb(dbPath, ({ init }) => {
      init.initializeDatabase();
      expect(() => init.initializeDatabase()).not.toThrow();
    });
  });

  test('initializeDatabase rethrows underlying errors', () => {
    jest.isolateModules(() => {
      // Stub the connection module so getConnection throws.
      jest.doMock('../src/db/connection', () => ({
        getConnection: () => {
          throw new Error('forced db failure');
        },
        closeConnection: () => {},
      }));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        const { initializeDatabase } = require('../src/db/init');
        expect(() => initializeDatabase()).toThrow(/forced db failure/);
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
        logSpy.mockRestore();
        jest.dontMock('../src/db/connection');
      }
    });
  });
});

describe('db/migrate.js', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-migrate-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('runMigrations applies all known migrations', () => {
    const dbPath = path.join(tmpDir, 'migrate.db');

    withIsolatedDb(dbPath, ({ migrate, connection }) => {
      migrate.runMigrations();

      const db = connection.getConnection();
      const versions = db
        .prepare('SELECT version FROM migrations ORDER BY version')
        .all()
        .map((r) => r.version);
      expect(versions).toEqual(expect.arrayContaining([1, 2]));
    });
  });

  test('runMigrations is a no-op on the second invocation', () => {
    const dbPath = path.join(tmpDir, 'migrate-idem.db');

    withIsolatedDb(dbPath, ({ migrate, connection }) => {
      migrate.runMigrations();

      const db = connection.getConnection();
      const before = db.prepare('SELECT COUNT(*) as c FROM migrations').get().c;

      // Second run should hit the "No pending migrations" branch.
      migrate.runMigrations();

      const after = db.prepare('SELECT COUNT(*) as c FROM migrations').get().c;
      expect(after).toBe(before);
    });
  });
});
