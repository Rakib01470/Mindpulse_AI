import type { Priority, TaskStatus, TaskWithCategory } from '../database/types';

export interface TaskFilter {
  categoryId: string | 'all';
  status: TaskStatus | 'all';
  priority: Priority | 'all';
  query: string;
}

export const DEFAULT_TASK_FILTER: TaskFilter = { categoryId: 'all', status: 'all', priority: 'all', query: '' };

/** Applies the Tasks-screen filters; input order (the default sort from SQL) is preserved. */
export function filterTasks(tasks: TaskWithCategory[], f: TaskFilter): TaskWithCategory[] {
  const q = f.query.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (f.categoryId === 'all' || t.category_id === f.categoryId) &&
      (f.status === 'all' || t.status === f.status) &&
      (f.priority === 'all' || t.priority === f.priority) &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        (t.summary ?? '').toLowerCase().includes(q) ||
        (t.details ?? '').toLowerCase().includes(q) ||
        t.category_name.toLowerCase().includes(q)),
  );
}
