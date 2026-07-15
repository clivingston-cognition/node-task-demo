const { v4: uuidv4 } = require('uuid');
const { getConnection, closeConnection } = require('./connection');
const { initializeDatabase } = require('./init');

const SEED_TODOS = [
  {
    title: 'Set up project structure',
    description: 'Initialize the Node.js project with Express 4.x and configure all dependencies',
    completed: 1,
    priority: 'high',
    tags: JSON.stringify(['setup', 'devops']),
    due_date: '2024-01-15',
  },
  {
    title: 'Implement CRUD API endpoints',
    description: 'Create RESTful endpoints for creating, reading, updating, and deleting TODO items',
    completed: 1,
    priority: 'urgent',
    tags: JSON.stringify(['backend', 'api']),
    due_date: '2024-01-20',
  },
  {
    title: 'Build frontend UI',
    description: 'Design and implement a clean, responsive user interface using EJS templates',
    completed: 0,
    priority: 'high',
    tags: JSON.stringify(['frontend', 'ui']),
    due_date: '2024-01-25',
    scheduled_at: '2024-01-24T09:00:00.000Z',
  },
  {
    title: 'Write unit tests',
    description: 'Add comprehensive test coverage for all API endpoints using Jest and Supertest',
    completed: 0,
    priority: 'medium',
    tags: JSON.stringify(['testing', 'quality']),
    due_date: '2024-02-01',
    scheduled_at: '2024-01-31T14:30:00.000Z',
  },
  {
    title: 'Add input validation',
    description: 'Implement server-side validation for all incoming request data',
    completed: 0,
    priority: 'medium',
    tags: JSON.stringify(['security', 'backend']),
    due_date: '2024-02-05',
  },
  {
    title: 'Configure CI/CD pipeline',
    description: 'Set up automated testing and deployment pipeline with GitHub Actions',
    completed: 0,
    priority: 'low',
    tags: JSON.stringify(['devops', 'automation']),
    due_date: '2024-02-10',
  },
  {
    title: 'Review security best practices',
    description: 'Audit the application for common security vulnerabilities and apply fixes',
    completed: 0,
    priority: 'high',
    tags: JSON.stringify(['security', 'review']),
    due_date: null,
  },
  {
    title: 'Write API documentation',
    description: 'Document all REST API endpoints with request/response examples',
    completed: 0,
    priority: 'low',
    tags: JSON.stringify(['documentation']),
    due_date: '2024-03-01',
  },
];

function seedDatabase() {
  initializeDatabase();
  const db = getConnection();

  const existingCount = db.prepare('SELECT COUNT(*) as count FROM todos').get().count;
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} todos. Skipping seed.`);
    return;
  }

  const insert = db.prepare(`
    INSERT INTO todos (id, title, description, completed, priority, tags, due_date, scheduled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((todos) => {
    for (const todo of todos) {
      insert.run(
        uuidv4(),
        todo.title,
        todo.description,
        todo.completed,
        todo.priority,
        todo.tags,
        todo.due_date,
        todo.scheduled_at || null,
      );
    }
  });

  insertAll(SEED_TODOS);
  console.log(`Seeded ${SEED_TODOS.length} todos.`);
}

if (require.main === module) {
  seedDatabase();
  closeConnection();
  console.log('Done.');
}

module.exports = { seedDatabase };
