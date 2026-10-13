import { createNodeDb } from './helpers/nodeDb';
import { initDatabase } from '../src/database/db';
import { MESSAGES } from '../src/utils/constants';

describe('Phase 1 — SQLite foundation', () => {
  it('creates every table, seeds the two default categories and logs the ready message', async () => {
    const db = createNodeDb();
    const logs: string[] = [];
    await initDatabase(db, (m) => logs.push(m));

    expect(logs).toContain(MESSAGES.dbReady);
    expect(MESSAGES.dbReady).toBe('Database initialized successfully');

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['categories', 'notes', 'projects', 'settings', 'tasks', 'time_logs']),
    );

    const cats = await db.getAllAsync<{ id: string; name: string; is_system: number }>(
      'SELECT id, name, is_system FROM categories ORDER BY id',
    );
    expect(cats).toEqual([
      { id: 'cat_office', name: 'Office Work', is_system: 1 },
      { id: 'cat_personal', name: 'Personal Work', is_system: 1 },
    ]);

    const fk = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(fk?.foreign_keys).toBe(1);
  });

  it('is idempotent across restarts (no duplicate seeds, data kept)', async () => {
    const db = createNodeDb();
    await initDatabase(db, () => undefined);
    await db.runAsync("INSERT INTO notes VALUES ('n1','General','t','c','x','x')");
    await initDatabase(db, () => undefined);
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM categories');
    expect(count?.n).toBe(2);
    const notes = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM notes');
    expect(notes?.n).toBe(1);
  });

  it('enforces the schema CHECK constraints', async () => {
    const db = createNodeDb();
    await initDatabase(db, () => undefined);
    await expect(
      db.runAsync(
        "INSERT INTO tasks (id,title,category_id,priority,created_at,updated_at) VALUES ('t','x','cat_office','Urgent','x','x')",
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        "INSERT INTO tasks (id,title,category_id,progress_percent,created_at,updated_at) VALUES ('t','x','cat_office',101,'x','x')",
      ),
    ).rejects.toThrow();
  });
});
