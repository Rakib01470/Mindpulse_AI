import type { Category, DbLike, Priority, Task, TaskStatus, TaskWithCategory } from './types';
import { ValidationError } from './types';
import { CATEGORY_OFFICE_ID, CATEGORY_PERSONAL_ID, LIMITS, MESSAGES, PRIORITIES } from '../utils/constants';
import { isHHmm, isIsoDate } from '../utils/formatting';
import { newId, nowIso } from '../utils/id';

export class DuplicateCategoryError extends ValidationError {
  constructor() {
    super(MESSAGES.categoryExists);
    this.name = 'DuplicateCategoryError';
  }
}

export interface TaskInput {
  title: string;
  category_id?: string;
  priority?: Priority;
  due_date?: string | null;
  due_time?: string | null;
  summary?: string | null;
  details?: string | null;
  progress_percent?: number;
  status?: TaskStatus;
}

/** Status implied by a progress value: 100 → Completed, 1–99 → In Progress, 0 → Pending. */
export const statusForProgress = (p: number): TaskStatus => (p >= 100 ? 'Completed' : p > 0 ? 'In Progress' : 'Pending');

const clampProgress = (p: number) => Math.max(0, Math.min(100, Math.round(p)));

/** Section 4 validation. Returns a cleaned copy or throws ValidationError. */
export function validateTaskInput(input: TaskInput): Required<Omit<TaskInput, 'status'>> & { status?: TaskStatus } {
  const title = (input.title ?? '').replace(/\s+/g, ' ').trim();
  if (title.length < 1 || title.length > LIMITS.taskTitle) {
    throw new ValidationError(`Title must be 1–${LIMITS.taskTitle} characters.`);
  }
  const priority = input.priority ?? 'Medium';
  if (!PRIORITIES.includes(priority)) throw new ValidationError('Priority must be High, Medium or Low.');
  const due_date = input.due_date || null;
  if (due_date !== null && !isIsoDate(due_date)) throw new ValidationError('Due date must be YYYY-MM-DD.');
  const due_time = input.due_time || null;
  if (due_time !== null && !isHHmm(due_time)) throw new ValidationError('Due time must be HH:mm.');
  const progress = input.progress_percent ?? 0;
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    throw new ValidationError('Progress must be an integer between 0 and 100.');
  }
  return {
    title,
    category_id: input.category_id ?? CATEGORY_OFFICE_ID,
    priority,
    due_date,
    due_time,
    summary: input.summary?.trim() || null,
    details: input.details?.trim() || null,
    progress_percent: progress,
    status: input.status,
  };
}

/* ───────────── Categories ───────────── */

export async function getCategories(db: DbLike): Promise<Category[]> {
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY is_system DESC, created_at ASC, name ASC');
}

export async function findCategoryByName(db: DbLike, name: string): Promise<Category | null> {
  return db.getFirstAsync<Category>('SELECT * FROM categories WHERE LOWER(name) = LOWER(?)', [name.trim()]);
}

export async function insertCategory(db: DbLike, rawName: string): Promise<Category> {
  const name = rawName.replace(/\s+/g, ' ').trim();
  if (!name || name.length > LIMITS.categoryName) {
    throw new ValidationError(`Category name must be 1–${LIMITS.categoryName} characters.`);
  }
  if (await findCategoryByName(db, name)) throw new DuplicateCategoryError();
  const cat: Category = { id: newId('cat'), name, is_system: 0, created_at: nowIso() };
  await db.runAsync('INSERT INTO categories (id, name, is_system, created_at) VALUES (?, ?, 0, ?)', [cat.id, cat.name, cat.created_at]);
  return cat;
}

/**
 * Resolves an AI-suggested category name: exact (case-insensitive) match, then
 * "<name> Work" (e.g. "Office" → "Office Work"), otherwise creates it (F1).
 */
export async function findOrCreateCategoryByName(db: DbLike, rawName: string): Promise<Category> {
  const name = rawName.trim() || 'Office Work';
  const exact = await findCategoryByName(db, name);
  if (exact) return exact;
  if (!/\bwork$/i.test(name)) {
    const withWork = await findCategoryByName(db, `${name} Work`);
    if (withWork) return withWork;
  }
  return insertCategory(db, name);
}

/** Moves the category's tasks to Personal Work, then deletes it (F2). System categories cannot be deleted. */
export async function deleteCategory(db: DbLike, id: string): Promise<void> {
  const cat = await db.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', [id]);
  if (!cat) return;
  if (cat.is_system) throw new ValidationError('Default categories cannot be deleted.');
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE tasks SET category_id = ?, updated_at = ? WHERE category_id = ?', [CATEGORY_PERSONAL_ID, nowIso(), id]);
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  });
}

/* ───────────── Tasks ───────────── */

/** Default sort (F2): status Pending → In Progress → Completed, priority High → Low, earliest due first (undated last). */
export const TASK_ORDER_SQL = `
  ORDER BY
    CASE t.status WHEN 'Pending' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
    CASE t.priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END,
    t.due_date IS NULL, t.due_date, t.due_time IS NULL, t.due_time,
    t.created_at DESC`;

const SELECT_TASKS = `SELECT t.*, c.name AS category_name FROM tasks t JOIN categories c ON c.id = t.category_id`;

export async function getTasks(db: DbLike): Promise<TaskWithCategory[]> {
  return db.getAllAsync<TaskWithCategory>(`${SELECT_TASKS} ${TASK_ORDER_SQL}`);
}

export async function getTask(db: DbLike, id: string): Promise<TaskWithCategory | null> {
  return db.getFirstAsync<TaskWithCategory>(`${SELECT_TASKS} WHERE t.id = ?`, [id]);
}

export async function insertTask(db: DbLike, input: TaskInput): Promise<Task> {
  const v = validateTaskInput(input);
  const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE id = ?', [v.category_id]);
  if (!exists) throw new ValidationError('Category does not exist.');
  const now = nowIso();
  const task: Task = {
    id: newId('task'),
    title: v.title,
    category_id: v.category_id,
    priority: v.priority,
    due_date: v.due_date,
    due_time: v.due_time,
    summary: v.summary,
    details: v.details,
    progress_percent: v.progress_percent,
    status: v.status ?? statusForProgress(v.progress_percent),
    created_at: now,
    updated_at: now,
  };
  await db.runAsync(
    `INSERT INTO tasks (id, title, category_id, priority, due_date, due_time, summary, details, progress_percent, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [task.id, task.title, task.category_id, task.priority, task.due_date, task.due_time, task.summary, task.details, task.progress_percent, task.status, task.created_at, task.updated_at],
  );
  return task;
}

export async function updateTask(db: DbLike, id: string, patch: Partial<TaskInput>): Promise<Task> {
  const current = await db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!current) throw new ValidationError('Task not found.');
  const merged = validateTaskInput({ ...current, ...patch });
  const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE id = ?', [merged.category_id]);
  if (!exists) throw new ValidationError('Category does not exist.');
  // Keep status consistent with progress unless the caller set status explicitly.
  const status = patch.status ?? (patch.progress_percent !== undefined ? statusForProgress(merged.progress_percent) : current.status);
  const updated: Task = { ...current, ...merged, status, updated_at: nowIso() };
  await db.runAsync(
    `UPDATE tasks SET title = ?, category_id = ?, priority = ?, due_date = ?, due_time = ?, summary = ?, details = ?,
       progress_percent = ?, status = ?, updated_at = ? WHERE id = ?`,
    [updated.title, updated.category_id, updated.priority, updated.due_date, updated.due_time, updated.summary, updated.details, updated.progress_percent, updated.status, updated.updated_at, id],
  );
  return updated;
}

/** Slider handler (F2): 100% auto-completes; lowering from 100% re-opens the task. */
export async function updateProgress(db: DbLike, id: string, percent: number): Promise<Task> {
  return updateTask(db, id, { progress_percent: clampProgress(percent) });
}

/** Checkbox handler: completing sets 100%; un-checking re-opens as Pending at 0%. */
export async function setTaskCompleted(db: DbLike, id: string, completed: boolean): Promise<Task> {
  return completed
    ? updateTask(db, id, { status: 'Completed', progress_percent: 100 })
    : updateTask(db, id, { status: 'Pending', progress_percent: 0 });
}

export async function deleteTask(db: DbLike, id: string): Promise<void> {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
}
