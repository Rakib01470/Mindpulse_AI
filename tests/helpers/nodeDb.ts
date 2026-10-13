/**
 * Implements the DAO's DbLike interface on Node's built-in SQLite engine, so the
 * app's real SQL (schema, CHECK constraints, foreign keys, transactions) is exercised
 * exactly as expo-sqlite would run it on the device.
 */
import { DatabaseSync } from 'node:sqlite';
import type { DbLike, SqlValue } from '../../src/database/types';
import { initDatabase } from '../../src/database/db';

export function createNodeDb(path = ':memory:'): DbLike & { close(): void } {
  const db = new DatabaseSync(path);
  return {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, params: SqlValue[] = []) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getAllAsync: async <T,>(sql: string, params: SqlValue[] = []) => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: SqlValue[] = []) =>
      ((db.prepare(sql).get(...params) as T | undefined) ?? null),
    withTransactionAsync: async (task) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}

export async function freshDb(path = ':memory:') {
  const db = createNodeDb(path);
  await initDatabase(db, () => undefined);
  return db;
}
