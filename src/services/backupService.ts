import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { Category, DbLike, Note, Project, Task, TimeLog } from '../database/types';
import { SCHEMA_VERSION, seedDefaultCategories } from '../database/db';
import { getSetting, deleteSetting } from '../database/settingsDao';
import { APP_NAME, PRIORITIES, PROJECT_STATUSES, SETTINGS_KEYS, TASK_STATUSES } from '../utils/constants';
import { isHHmm, isIsoDate, toIsoDate } from '../utils/formatting';
import { parseTimer } from '../utils/timer';

export const BACKUP_KEYS = ['categories', 'tasks', 'projects', 'time_logs', 'notes'] as const;

export interface BackupData {
  app: string;
  format_version: number;
  schema_version: number;
  exported_at: string;
  categories: Category[];
  tasks: Task[];
  projects: Project[];
  time_logs: TimeLog[];
  notes: Note[];
}

export class BackupValidationError extends Error {
  constructor(public detail: string) {
    super(`Invalid backup: ${detail}`);
    this.name = 'BackupValidationError';
  }
}

export const backupFileName = (now = new Date()) => `mindpulse-backup-${toIsoDate(now)}.json`;

/** Full relational dump (F6). Settings (incl. the encrypted API key) are deliberately excluded. */
export async function buildBackup(db: DbLike, now = new Date()): Promise<BackupData> {
  const data = {} as BackupData;
  await db.withTransactionAsync(async () => {
    data.categories = await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY created_at, id');
    data.tasks = await db.getAllAsync<Task>('SELECT * FROM tasks ORDER BY created_at, id');
    data.projects = await db.getAllAsync<Project>('SELECT * FROM projects ORDER BY created_at, id');
    data.time_logs = await db.getAllAsync<TimeLog>('SELECT * FROM time_logs ORDER BY created_at, id');
    data.notes = await db.getAllAsync<Note>('SELECT * FROM notes ORDER BY created_at, id');
  });
  return {
    app: APP_NAME,
    format_version: 1,
    schema_version: SCHEMA_VERSION,
    exported_at: now.toISOString(),
    categories: data.categories,
    tasks: data.tasks,
    projects: data.projects,
    time_logs: data.time_logs,
    notes: data.notes,
  };
}

/* ───────────── Validation ───────────── */

type Row = Record<string, unknown>;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optStr = (v: unknown) => v === null || v === undefined || isStr(v);

function check(cond: boolean, detail: string): asserts cond {
  if (!cond) throw new BackupValidationError(detail);
}

function rows(obj: Row, key: string): Row[] {
  const v = obj[key];
  check(Array.isArray(v), `missing "${key}" array`);
  (v as unknown[]).forEach((r, i) => check(!!r && typeof r === 'object' && !Array.isArray(r), `${key}[${i}] is not an object`));
  return v as Row[];
}

function uniqueIds(list: Row[], key: string): Set<string> {
  const ids = new Set<string>();
  list.forEach((r, i) => {
    check(isStr(r.id) && r.id.length > 0, `${key}[${i}].id missing`);
    check(!ids.has(r.id), `${key} has duplicate id ${r.id}`);
    ids.add(r.id);
  });
  return ids;
}

/** Validates structure, types, enums and references. Returns typed data or throws BackupValidationError. */
export function validateBackup(raw: unknown): BackupData {
  check(!!raw && typeof raw === 'object' && !Array.isArray(raw), 'root is not an object');
  const obj = raw as Row;
  const categories = rows(obj, 'categories');
  const tasks = rows(obj, 'tasks');
  const projects = rows(obj, 'projects');
  const timeLogs = rows(obj, 'time_logs');
  const notes = rows(obj, 'notes');

  const catIds = uniqueIds(categories, 'categories');
  const names = new Set<string>();
  categories.forEach((c, i) => {
    check(isStr(c.name) && c.name.trim().length > 0, `categories[${i}].name missing`);
    check(!names.has(c.name), `duplicate category name ${c.name}`);
    names.add(c.name);
    check(c.is_system === 0 || c.is_system === 1, `categories[${i}].is_system must be 0 or 1`);
    check(isStr(c.created_at), `categories[${i}].created_at missing`);
  });

  uniqueIds(tasks, 'tasks');
  tasks.forEach((t, i) => {
    const at = `tasks[${i}]`;
    check(isStr(t.title) && t.title.trim().length > 0, `${at}.title missing`);
    check(isStr(t.category_id) && catIds.has(t.category_id), `${at}.category_id does not match a category`);
    check(PRIORITIES.includes(t.priority as never), `${at}.priority invalid`);
    check(TASK_STATUSES.includes(t.status as never), `${at}.status invalid`);
    check(Number.isInteger(t.progress_percent) && (t.progress_percent as number) >= 0 && (t.progress_percent as number) <= 100, `${at}.progress_percent invalid`);
    check(t.due_date === null || t.due_date === undefined || isIsoDate(t.due_date as string), `${at}.due_date invalid`);
    check(t.due_time === null || t.due_time === undefined || isHHmm(t.due_time as string), `${at}.due_time invalid`);
    check(optStr(t.summary) && optStr(t.details), `${at} text fields invalid`);
    check(isStr(t.created_at) && isStr(t.updated_at), `${at} timestamps missing`);
  });

  const projectIds = uniqueIds(projects, 'projects');
  projects.forEach((p, i) => {
    const at = `projects[${i}]`;
    check(isStr(p.title) && p.title.trim().length > 0, `${at}.title missing`);
    check(isNum(p.target_hours) && p.target_hours > 0, `${at}.target_hours invalid`);
    check(Number.isInteger(p.tracked_seconds) && (p.tracked_seconds as number) >= 0, `${at}.tracked_seconds invalid`);
    check(PROJECT_STATUSES.includes(p.status as never), `${at}.status invalid`);
    check(optStr(p.description), `${at}.description invalid`);
    check(isStr(p.created_at) && isStr(p.updated_at), `${at} timestamps missing`);
  });

  uniqueIds(timeLogs, 'time_logs');
  timeLogs.forEach((l, i) => {
    const at = `time_logs[${i}]`;
    check(isStr(l.project_id) && projectIds.has(l.project_id), `${at}.project_id does not match a project`);
    check(isStr(l.start_time) && isStr(l.end_time), `${at} start/end missing`);
    check(Number.isInteger(l.duration_seconds) && (l.duration_seconds as number) >= 0, `${at}.duration_seconds invalid`);
    check(optStr(l.notes) && isStr(l.created_at), `${at} fields invalid`);
  });

  uniqueIds(notes, 'notes');
  notes.forEach((n, i) => {
    const at = `notes[${i}]`;
    check(isStr(n.topic) && n.topic.length > 0, `${at}.topic missing`);
    check(isStr(n.title), `${at}.title missing`);
    check(isStr(n.content) && n.content.trim().length > 0, `${at}.content empty`);
    check(isStr(n.created_at) && isStr(n.updated_at), `${at} timestamps missing`);
  });

  return {
    app: isStr(obj.app) ? obj.app : APP_NAME,
    format_version: isNum(obj.format_version) ? obj.format_version : 1,
    schema_version: isNum(obj.schema_version) ? obj.schema_version : SCHEMA_VERSION,
    exported_at: isStr(obj.exported_at) ? obj.exported_at : '',
    categories: categories as unknown as Category[],
    tasks: tasks as unknown as Task[],
    projects: projects as unknown as Project[],
    time_logs: timeLogs as unknown as TimeLog[],
    notes: notes as unknown as Note[],
  };
}

/** Parses file text; any JSON or structure problem becomes BackupValidationError. */
export function parseBackupText(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupValidationError('file is not valid JSON');
  }
  return validateBackup(raw);
}

/* ───────────── Restore ───────────── */

const nul = (v: unknown) => (v === undefined ? null : (v as string | number | null));

/**
 * Replaces all five tables with the backup inside one transaction. Any failure rolls back,
 * leaving the existing data untouched (Section 10). Settings are kept.
 */
export async function importBackup(db: DbLike, data: BackupData): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of ['time_logs', 'tasks', 'notes', 'projects', 'categories']) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    for (const c of data.categories) {
      await db.runAsync('INSERT INTO categories (id, name, is_system, created_at) VALUES (?, ?, ?, ?)', [c.id, c.name, c.is_system, c.created_at]);
    }
    for (const p of data.projects) {
      await db.runAsync(
        'INSERT INTO projects (id, title, description, target_hours, tracked_seconds, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.title, nul(p.description), p.target_hours, p.tracked_seconds, p.status, p.created_at, p.updated_at],
      );
    }
    for (const t of data.tasks) {
      await db.runAsync(
        `INSERT INTO tasks (id, title, category_id, priority, due_date, due_time, summary, details, progress_percent, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.title, t.category_id, t.priority, nul(t.due_date), nul(t.due_time), nul(t.summary), nul(t.details), t.progress_percent, t.status, t.created_at, t.updated_at],
      );
    }
    for (const l of data.time_logs) {
      await db.runAsync(
        'INSERT INTO time_logs (id, project_id, start_time, end_time, duration_seconds, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [l.id, l.project_id, l.start_time, l.end_time, l.duration_seconds, nul(l.notes), l.created_at],
      );
    }
    for (const n of data.notes) {
      await db.runAsync('INSERT INTO notes (id, topic, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        n.id,
        n.topic,
        n.title,
        n.content,
        n.created_at,
        n.updated_at,
      ]);
    }
  });
  await seedDefaultCategories(db);
  // Drop a running timer whose project is not in the restored data.
  const timer = parseTimer(await getSetting(db, SETTINGS_KEYS.activeTimer));
  if (timer && !data.projects.some((p) => p.id === timer.projectId)) await deleteSetting(db, SETTINGS_KEYS.activeTimer);
}

/* ───────────── Device I/O (Android share sheet / file picker) ───────────── */

/** Writes mindpulse-backup-YYYY-MM-DD.json and opens the Android share dialog. Returns the file URI. */
export async function exportBackupToShare(db: DbLike): Promise<string> {
  const data = await buildBackup(db);
  const uri = `${FileSystem.cacheDirectory}${backupFileName()}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save MindPulse backup', UTI: 'public.json' });
  }
  return uri;
}

/** Opens the system file picker and returns validated backup data, or null if the user cancelled. */
export async function pickBackupFile(): Promise<BackupData | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
  return parseBackupText(text);
}
