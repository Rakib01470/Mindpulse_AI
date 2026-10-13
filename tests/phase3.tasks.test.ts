import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers/nodeDb';
import * as dao from '../src/database/tasksDao';
import { normalizeParsedTask } from '../src/services/aiService';
import { filterTasks, DEFAULT_TASK_FILTER } from '../src/utils/taskFilters';
import { MESSAGES } from '../src/utils/constants';
import type { DbLike } from '../src/database/types';

/** Mirrors TasksContext.addTask: resolve category by name, then insert. */
async function saveFromVoice(db: DbLike, aiReply: object, transcript: string) {
  const parsed = normalizeParsedTask(aiReply, transcript);
  const cat = await dao.findOrCreateCategoryByName(db, parsed.category_name);
  return dao.insertTask(db, { ...parsed, category_id: cat.id });
}

describe('Phase 3 checkpoint — voice task → 50% → complete → survives restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mindpulse-'));
  const file = join(dir, 'mindpulse.db');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('runs the full flow against an on-disk database', async () => {
    let db = await freshDb(file);
    const task = await saveFromVoice(
      db,
      { title: 'Review branch audit report', category_name: 'Office Work', priority: 'High', due_date: '2026-10-13', due_time: '16:00', summary: 'Review the branch audit report by 4 PM.' },
      'High priority office task review branch audit report by 4 PM',
    );
    expect(task.category_id).toBe('cat_office');
    expect(task.status).toBe('Pending');

    const half = await dao.updateProgress(db, task.id, 50);
    expect(half.progress_percent).toBe(50);
    expect(half.status).toBe('In Progress');

    const done = await dao.setTaskCompleted(db, task.id, true);
    expect(done.status).toBe('Completed');
    expect(done.progress_percent).toBe(100);
    db.close();

    // "Force restart": new connection + init on the same file.
    db = await freshDb(file);
    const reloaded = await dao.getTask(db, task.id);
    expect(reloaded).toMatchObject({ status: 'Completed', progress_percent: 100, category_name: 'Office Work', due_time: '16:00' });
    db.close();
  });
});

describe('Phase 3 — task rules (F2)', () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });
  afterEach(() => db.close());

  it('slider to 100% auto-completes; lowering re-opens', async () => {
    const t = await dao.insertTask(db, { title: 'X' });
    expect((await dao.updateProgress(db, t.id, 100)).status).toBe('Completed');
    expect((await dao.updateProgress(db, t.id, 40)).status).toBe('In Progress');
    expect((await dao.updateProgress(db, t.id, 0)).status).toBe('Pending');
  });

  it('un-checking a completed task re-opens it', async () => {
    const t = await dao.insertTask(db, { title: 'X' });
    await dao.setTaskCompleted(db, t.id, true);
    expect(await dao.setTaskCompleted(db, t.id, false)).toMatchObject({ status: 'Pending', progress_percent: 0 });
  });

  it('default sort: status → priority → due date (undated last)', async () => {
    await dao.insertTask(db, { title: 'done-high', priority: 'High', status: 'Completed', progress_percent: 100 });
    await dao.insertTask(db, { title: 'low-early', priority: 'Low', due_date: '2026-10-01' });
    await dao.insertTask(db, { title: 'high-nodate', priority: 'High' });
    await dao.insertTask(db, { title: 'high-late', priority: 'High', due_date: '2026-12-01' });
    await dao.insertTask(db, { title: 'high-early', priority: 'High', due_date: '2026-10-20', due_time: '09:00' });
    await dao.insertTask(db, { title: 'inprog-high', priority: 'High', progress_percent: 30 });
    await dao.insertTask(db, { title: 'med', priority: 'Medium', due_date: '2026-10-15' });
    const order = (await dao.getTasks(db)).map((t) => t.title);
    expect(order).toEqual(['high-early', 'high-late', 'high-nodate', 'med', 'low-early', 'inprog-high', 'done-high']);
  });

  it('validates Section 4 field rules', async () => {
    await expect(dao.insertTask(db, { title: '   ' })).rejects.toThrow('Title must be');
    await expect(dao.insertTask(db, { title: 'x'.repeat(151) })).rejects.toThrow('Title must be');
    await expect(dao.insertTask(db, { title: 'x', due_date: '13-10-2026' })).rejects.toThrow('YYYY-MM-DD');
    await expect(dao.insertTask(db, { title: 'x', due_time: '25:00' })).rejects.toThrow('HH:mm');
    await expect(dao.insertTask(db, { title: 'x', category_id: 'nope' })).rejects.toThrow('Category does not exist');
    const t = await dao.insertTask(db, { title: '  Trim   me  ' });
    expect(t).toMatchObject({ title: 'Trim me', category_id: 'cat_office', priority: 'Medium', progress_percent: 0 });
  });

  it('custom categories: duplicates blocked case-insensitively with the exact message', async () => {
    await dao.insertCategory(db, 'Academic Work');
    await expect(dao.insertCategory(db, 'academic work')).rejects.toThrow(MESSAGES.categoryExists);
    await expect(dao.insertCategory(db, 'OFFICE WORK')).rejects.toThrow('Category already exists');
  });

  it('deleting a category moves its tasks to Personal Work (manual test script)', async () => {
    const cat = await dao.insertCategory(db, 'Consultation Work');
    const t = await dao.insertTask(db, { title: 'Client call', category_id: cat.id });
    await dao.deleteCategory(db, cat.id);
    expect((await dao.getTask(db, t.id))?.category_name).toBe('Personal Work');
    expect(MESSAGES.deleteCategory('Consultation Work')).toBe(
      "Delete category 'Consultation Work'? Associated tasks will be moved to 'Personal Work'.",
    );
    await expect(dao.deleteCategory(db, 'cat_office')).rejects.toThrow('cannot be deleted');
  });

  it('AI category names: reuse existing, map "Office" → "Office Work", create genuinely new', async () => {
    expect((await dao.findOrCreateCategoryByName(db, 'office work')).id).toBe('cat_office');
    expect((await dao.findOrCreateCategoryByName(db, 'Personal')).id).toBe('cat_personal');
    const created = await dao.findOrCreateCategoryByName(db, 'Business Work');
    expect(created.is_system).toBe(0);
    expect((await dao.getCategories(db)).map((c) => c.name)).toEqual(['Office Work', 'Personal Work', 'Business Work']);
  });

  it('filters by category, status, priority and search text', async () => {
    const acad = await dao.insertCategory(db, 'Academic Work');
    await dao.insertTask(db, { title: 'Draft paper intro', category_id: acad.id, priority: 'High' });
    await dao.insertTask(db, { title: 'Pay electricity bill', category_id: 'cat_personal', priority: 'Low' });
    await dao.insertTask(db, { title: 'Compliance report', priority: 'High', status: 'Completed', progress_percent: 100 });
    const all = await dao.getTasks(db);
    const f = DEFAULT_TASK_FILTER;
    expect(filterTasks(all, { ...f, categoryId: acad.id }).map((t) => t.title)).toEqual(['Draft paper intro']);
    expect(filterTasks(all, { ...f, status: 'Completed' }).map((t) => t.title)).toEqual(['Compliance report']);
    expect(filterTasks(all, { ...f, priority: 'High', status: 'Pending' }).map((t) => t.title)).toEqual(['Draft paper intro']);
    expect(filterTasks(all, { ...f, query: 'BILL' }).map((t) => t.title)).toEqual(['Pay electricity bill']);
  });
});
