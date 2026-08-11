# Task Manager

A sophisticated Task Manager application built with **Node.js 24** and **Express 4.x**, featuring a SQLite local database, full CRUD API, a responsive dark-themed UI, and comprehensive test coverage.

## Tech Stack

| Component      | Technology                    | Version   |
|----------------|-------------------------------|-----------|
| Runtime        | Node.js                       | 24.x LTS  |
| Framework      | Express.js                    | 4.22.x    |
| Database       | SQLite (via better-sqlite3)   | 12.x      |
| Templating     | EJS                           | 3.x       |
| Validation     | express-validator             | 7.x       |
| Testing        | Jest + Supertest              | 29.x / 7.x |
| Linting        | ESLint                        | 8.x       |

## Features

- Full CRUD operations for TODO items
- Priority levels: low, medium, high, urgent
- Tags, due dates, and descriptions
- Search and filtering (by status, priority, tags)
- Sortable and paginated list view
- Stats dashboard (total, pending, completed, overdue)
- Toggle completion status
- Bulk delete completed items
- Input validation on all endpoints
- Rate limiting, CORS, Helmet security headers
- Responsive dark-themed UI
- SQLite database with WAL mode for performance

---

## Prerequisites

- **Node.js 24.x** (required — the app enforces this via `engines` in `package.json`)
- **npm** (comes with Node.js)
- **nvm** (recommended for managing Node versions)

## Setup & Installation

### 1. Install Node.js 24

```bash
# Using nvm (recommended)
nvm install 24
nvm use 24

# Verify
node --version   # Should show v24.x.x
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize the Database

```bash
# Create the database and run migrations
npm run db:init

# (Optional) Seed with sample data
npm run db:seed
```

## Running the App

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
NODE_ENV=production npm start
```

The app will start on **http://localhost:3000** by default.

### Environment Variables

| Variable              | Default       | Description                     |
|-----------------------|---------------|---------------------------------|
| `PORT`                | `3000`        | Server port                     |
| `HOST`                | `0.0.0.0`    | Server host                     |
| `NODE_ENV`            | `development` | Environment (development/test/production) |
| `DB_PATH`             | `data/todo.db`| SQLite database file path       |
| `RATE_LIMIT_WINDOW_MS`| `900000`     | Rate limit window (ms)          |
| `RATE_LIMIT_MAX`      | `100`         | Max requests per window         |
| `CORS_ORIGIN`         | `*`           | CORS allowed origin             |

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage Report

```bash
npm run test:coverage
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

Tests use a **separate test database** (`data/todo-test.db`) that is automatically created and cleaned up. The test suite covers:

- **Create (POST)**: Valid creation, all fields, validation errors (missing title, invalid priority, bad dates, etc.)
- **Read All (GET)**: Pagination, filtering by status/priority, search, sorting, validation of query params
- **Read One (GET)**: Fetch by ID, 404 for missing, 400 for invalid UUID
- **Update (PUT)**: Individual field updates, multi-field updates, timestamp changes, validation errors
- **Toggle (PATCH)**: Toggle complete/incomplete, idempotency
- **Delete One (DELETE)**: Successful deletion, verification of removal, 404 for missing
- **Delete Completed (DELETE)**: Bulk deletion of completed items
- **Stats (GET)**: Stats accuracy, count verification after operations
- **Edge Cases**: Large page numbers, XSS input, concurrent creates, tag filtering

---

## Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

---

## Database Management

```bash
# Initialize database (create tables)
npm run db:init

# Seed database with sample data
npm run db:seed

# Reset database (delete and re-seed)
npm run db:reset
```

---

## API Reference

### Base URL: `/api`

#### List Todos
```
GET /api/todos?page=1&limit=20&sort=created_at&order=DESC&completed=false&priority=high&search=keyword&tag=work
```

#### Get Todo by ID
```
GET /api/todos/:id
```

#### Create Todo
```
POST /api/todos
Content-Type: application/json

{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "priority": "high",
  "tags": ["shopping", "personal"],
  "due_date": "2025-01-15"
}
```

#### Batch Create Todos

Creates up to 100 todos in a single atomic transaction — if any item fails
validation, no todos are created.

```
POST /api/todos/batch
Content-Type: application/json

{
  "todos": [
    { "title": "Buy groceries", "priority": "high", "tags": ["shopping"] },
    { "title": "Write report", "description": "Q1 summary", "due_date": "2025-01-15" }
  ]
}
```

Response `201`:
```json
{
  "success": true,
  "data": [
    {
      "id": "3f1c...",
      "title": "Buy groceries",
      "description": "",
      "completed": false,
      "priority": "high",
      "tags": ["shopping"],
      "due_date": null,
      "created_at": "2025-01-10T12:00:00.000Z",
      "updated_at": "2025-01-10T12:00:00.000Z"
    },
    {
      "id": "8ba2...",
      "title": "Write report",
      "description": "Q1 summary",
      "completed": false,
      "priority": "medium",
      "tags": [],
      "due_date": "2025-01-15",
      "created_at": "2025-01-10T12:00:00.000Z",
      "updated_at": "2025-01-10T12:00:00.000Z"
    }
  ],
  "meta": { "count": 2 }
}
```

#### Update Todo
```
PUT /api/todos/:id
Content-Type: application/json

{
  "title": "Updated title",
  "completed": true,
  "priority": "urgent"
}
```

#### Toggle Completion
```
PATCH /api/todos/:id/toggle
```

#### Delete Todo
```
DELETE /api/todos/:id
```

#### Delete All Completed
```
DELETE /api/todos
```

#### Get Stats
```
GET /api/todos/stats
```

---

## Project Structure

```
.
├── README.md
├── package.json
├── jest.config.js
├── .eslintrc.json
├── .nvmrc
├── .gitignore
├── src/
│   ├── server.js          # Entry point, starts HTTP server
│   ├── app.js             # Express app configuration
│   ├── config/
│   │   └── index.js       # Centralized configuration
│   ├── db/
│   │   ├── connection.js  # SQLite connection manager
│   │   ├── migrate.js     # Database migrations
│   │   ├── init.js        # Database initialization
│   │   ├── seed.js        # Sample data seeder
│   │   └── reset.js       # Database reset utility
│   ├── models/
│   │   └── todo.js        # Todo data model (CRUD operations)
│   ├── routes/
│   │   ├── api.js         # REST API routes
│   │   └── views.js       # View rendering routes
│   ├── middleware/
│   │   ├── errorHandler.js # Error handling middleware
│   │   └── validators.js  # Request validation middleware
│   ├── views/
│   │   ├── index.ejs      # Main page template
│   │   └── error.ejs      # Error page template
│   └── public/
│       ├── css/
│       │   └── styles.css # Application styles
│       └── js/
│           └── app.js     # Frontend JavaScript
└── tests/
    └── api.test.js        # API endpoint tests
```

---

## License

MIT
