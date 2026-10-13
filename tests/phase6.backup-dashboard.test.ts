import { freshDb } from './helpers/nodeDb';
import * as tasks from '../src/database/tasksDao';
import * as projects from '../src/database/projectsDao';
import * as notes from '../src/database/notesDao';
import { getSetting, setSetting } from '../src/database/settingsDao';
import { getDashboardData } from '../src/database/dashboardDao';
import { BACKUP_KEYS, BackupValidationError, backupFileName, buildBackup, importBackup, parseBackupText, validateBackup } from '../src/services/backupService';
import { SETTINGS_KEYS } from '../src/utils/constants';
import { serializeTimer, startTimer } from '../src/utils/timer';
import type { DbLike } from '../src/database/types';

const TABLES = ['categories', 'tasks', 'projects', 'time_logs', 'notes'] as const;
const dump = async (db: DbLike) => {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await db.getAllAsync(`SELECT * FROM ${t} ORDER BY id`);
  return out;
};

/** Seeds data like the manual test script: voice task, custom category, project with sessions, notes. */
async function seed(db: DbLike) {
  const consult = await tasks.insertCategory(db, 'Consultation Work');
  await tasks.insertTask(db, { title: 'Submit monthly branch compliance report', priority: 'High', due_date: '2026-10-16', due_time: '17:00', summary: 'S'.repeat(1200) });
  await tasks.insertTask(db, { title: 'Client follow-up', category_id: consult.id, progress_percent: 40 });
  await tasks.insertTask(db, { title: 'Done thing', status: 'Completed', progress_percent: 100, category_id: 'cat_personal' });
  const p = await projects.insertProject(db, { title: '3D Asset Dev', target_hours: 50, description: 'Low-poly props' });
  await projects.logSession(db, { project_id: p.id, start_time: '2026-10-12T10:00:00.000Z', end_time: '2026-10-12T11:30:00.000Z', duration_seconds: 5400, notes: 'Sword model' });
  await projects.addManualTime(db, p.id, 2);
  await notes.insertNote(db, { topic: 'Web Novel', title: 'Chapter 5', content: 'The mentor is the villain.' });
  await notes.insertNote(db, { topic: 'বাংলা', content: 'ইউনিকোড নোট ✓' });
}

describe('Phase 6 checkpoint — export → clear app data → import → 100% restored', () => {
  it('restores every row of every table exactly', async () => {
    const original = await freshDb();
    await seed(original);
    const before = await dump(original);

    const json = JSON.stringify(await buildBackup(original), null, 2);
    original.close();

    // "Clear app data": brand-new database with only the default seed.
    const wiped = await freshDb();
    expect((await dump(wiped)).tasks).toHaveLength(0);

    await importBackup(wiped, parseBackupText(json));
    const after = await dump(wiped);
    expect(after).toEqual(before);
    expect(after.tasks).toHaveLength(3);
    expect(after.time_logs).toHaveLength(2);
    expect(after.notes).toHaveLength(2);
    wiped.close();
  });

  it('manual-test variant: delete a task, import the earlier backup, the task is back', async () => {
    const db = await freshDb();
    await seed(db);
    const backup = parseBackupText(JSON.stringify(await buildBackup(db)));
    const victim = (await tasks.getTasks(db))[0];
    await tasks.deleteTask(db, victim.id);
    await importBackup(db, backup);
    expect(await tasks.getTask(db, victim.id)).not.toBeNull();
    db.close();
  });

  it('export contains the full relational dump, no settings/API key, and a dated filename', async () => {
    const db = await freshDb();
    await seed(db);
    await setSetting(db, SETTINGS_KEYS.apiKeyCipher, 'v1:secret');
    const b = await buildBackup(db, new Date(2026, 9, 18));
    for (const k of BACKUP_KEYS) expect(Array.isArray(b[k])).toBe(true);
    expect(JSON.stringify(b)).not.toContain('v1:secret');
    expect(backupFileName(new Date(2026, 9, 18))).toBe('mindpulse-backup-2026-10-18.json');
    db.close();
  });
});

describe('Section 9 — backup validator rejects malformed payloads', () => {
  let good: ReturnType<typeof validateBackup>;
  beforeAll(async () => {
    const db = await freshDb();
    await seed(db);
    good = await buildBackup(db);
    db.close();
  });
  const mutate = (fn: (o: Record<string, any>) => void) => {
    const o = JSON.parse(JSON.stringify(good));
    fn(o);
    return o;
  };

  const cases: [string, () => string][] = [
    ['not JSON', () => '{not json'],
    ['array root', () => '[]'],
    ['missing tasks key', () => JSON.stringify(mutate((o) => delete o.tasks))],
    ['missing time_logs key', () => JSON.stringify(mutate((o) => delete o.time_logs))],
    ['tasks not an array', () => JSON.stringify(mutate((o) => (o.tasks = {})))],
    ['bad priority', () => JSON.stringify(mutate((o) => (o.tasks[0].priority = 'Urgent')))],
    ['progress out of range', () => JSON.stringify(mutate((o) => (o.tasks[0].progress_percent = 150)))],
    ['dangling category', () => JSON.stringify(mutate((o) => (o.tasks[0].category_id = 'cat_ghost')))],
    ['dangling project', () => JSON.stringify(mutate((o) => (o.time_logs[0].project_id = 'proj_ghost')))],
    ['duplicate ids', () => JSON.stringify(mutate((o) => (o.notes[1].id = o.notes[0].id)))],
    ['empty note', () => JSON.stringify(mutate((o) => (o.notes[0].content = ' ')))],
    ['bad date', () => JSON.stringify(mutate((o) => (o.tasks[0].due_date = '16-10-2026')))],
  ];
  it.each(cases)('%s', (_label, make) => {
    expect(() => parseBackupText(make())).toThrow(BackupValidationError);
  });

  it('a failed import rolls back and keeps existing data', async () => {
    const db = await freshDb();
    await seed(db);
    const before = await dump(db);
    // Passes validation but violates the UNIQUE(name) constraint mid-transaction.
    const evil = mutate((o) => o.categories.push({ ...o.categories[0], id: 'cat_dupe_name' }));
    evil.categories[evil.categories.length - 1].name = 'Office Work ';
    evil.categories.push({ id: 'cat_x', name: 'Office Work', is_system: 0, created_at: 'x' });
    await expect(importBackup(db, evil as never)).rejects.toThrow();
    expect(await dump(db)).toEqual(before);
    db.close();
  });

  it('import drops a running timer whose project is gone', async () => {
    const db = await freshDb();
    await setSetting(db, SETTINGS_KEYS.activeTimer, serializeTimer(startTimer({ id: 'proj_gone', title: 'Gone' }, 0)));
    await importBackup(db, good);
    expect(await getSetting(db, SETTINGS_KEYS.activeTimer)).toBeNull();
    db.close();
  });
});

describe('F5 — dashboard metrics', () => {
  it('loads everything in one transaction well under 300 ms, with the right selections', async () => {
    const db = await freshDb();
    const now = new Date(2026, 9, 13, 18, 0); // Tue 18:00 local
    await tasks.insertTask(db, { title: 'High, later', priority: 'High', due_date: '2026-10-20' });
    await tasks.insertTask(db, { title: 'Low but overdue', priority: 'Low', due_date: '2026-10-10' });
    await tasks.insertTask(db, { title: 'Medium due 17:00 today (overdue)', due_date: '2026-10-13', due_time: '17:00' });
    await tasks.insertTask(db, { title: 'High no date', priority: 'High' });
    await tasks.insertTask(db, { title: 'Medium due tomorrow', due_date: '2026-10-14' });
    await tasks.insertTask(db, { title: 'High completed', priority: 'High', status: 'Completed', progress_percent: 100 });
    const p = await projects.insertProject(db, { title: '3D Asset Dev' });
    await projects.insertProject(db, { title: 'Paused', status: 'On Hold' });
    await projects.logSession(db, { project_id: p.id, start_time: '2026-10-12T04:00:00.000Z', end_time: '2026-10-12T05:00:00.000Z', duration_seconds: 3600 });
    await projects.logSession(db, { project_id: p.id, start_time: '2026-10-03T04:00:00.000Z', end_time: '2026-10-03T05:00:00.000Z', duration_seconds: 7200 }); // last week
    for (let i = 0; i < 5; i++) await notes.insertNote(db, { content: `note ${i}` });

    // Bulk rows to make the timing meaningful.
    for (let i = 0; i < 2000; i++) await tasks.insertTask(db, { title: `bulk ${i}`, priority: 'Low' });

    const d = await getDashboardData(db, now);
    expect(d.loadMs).toBeLessThan(300);
    expect(d.urgentTasks.map((t) => t.title)).toEqual(['Low but overdue', 'Medium due 17:00 today (overdue)', 'High, later']);
    expect(d.urgentTasks.slice(0, 2).every((t) => t.overdue)).toBe(true);
    expect(d.activeProjects.map((x) => x.title)).toEqual(['3D Asset Dev']);
    expect(d.secondsThisWeek).toBe(3600); // week starts Sunday 11 Oct
    expect(d.recentNotes).toHaveLength(3);
    // The completed task was written with the real clock, so it counts as "today" only for today's date.
    expect((await getDashboardData(db, new Date())).completedToday).toBe(1);
    expect((await getDashboardData(db, new Date(2030, 0, 1))).completedToday).toBe(0);
    db.close();
  });

  it('empty database → nothing urgent, no projects (empty-state condition)', async () => {
    const db = await freshDb();
    const d = await getDashboardData(db);
    expect(d.urgentTasks).toHaveLength(0);
    expect(d.activeProjects).toHaveLength(0);
    expect(d.pendingCount).toBe(0);
    db.close();
  });
});
