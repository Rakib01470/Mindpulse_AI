import type { DbLike } from './types';
import { DEFAULT_CATEGORIES, MESSAGES } from '../utils/constants';
import { nowIso } from '../utils/id';

export const SCHEMA_VERSION = 1;

/** Section 4 schema, verbatim, plus indexes for the list/dashboard queries. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category_id TEXT NOT NULL,
  priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')) NOT NULL DEFAULT 'Medium',
  due_date TEXT,
  due_time TEXT,
  summary TEXT,
  details TEXT,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100),
  status TEXT CHECK(status IN ('Pending', 'In Progress', 'Completed')) NOT NULL DEFAULT 'Pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_hours REAL NOT NULL DEFAULT 100.0,
  tracked_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT CHECK(status IN ('Active', 'On Hold', 'Completed')) NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_time_logs_project ON time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_end ON time_logs(end_time);
CREATE INDEX IF NOT EXISTS idx_notes_topic ON notes(topic);
`;

export const TABLES = ['categories', 'tasks', 'projects', 'time_logs', 'notes', 'settings'] as const;

/** Insert Office Work / Personal Work if missing (safe to call repeatedly). */
export async function seedDefaultCategories(db: DbLike): Promise<void> {
  const now = nowIso();
  for (const c of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, is_system, created_at) VALUES (?, ?, 1, ?)',
      [c.id, c.name, now],
    );
    // If a backup or older install had the same name under a different id, make sure the system row exists by id.
    await db.runAsync('UPDATE categories SET is_system = 1 WHERE id = ?', [c.id]);
  }
}

/**
 * Creates all tables, runs migrations, seeds defaults.
 * Logs "Database initialized successfully" (Phase 1 checkpoint).
 */
export async function initDatabase(db: DbLike, log: (msg: string) => void = console.log): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(SCHEMA_SQL);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current < SCHEMA_VERSION) {
    // Future migrations go here, keyed by version. v1 is the base schema above.
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  await seedDefaultCategories(db);
  log(MESSAGES.dbReady);
}
