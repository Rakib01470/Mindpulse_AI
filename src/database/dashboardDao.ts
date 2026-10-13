import type { DbLike, Note, Project, TaskWithCategory } from './types';
import { todayBoundsIso, toHHmm, toIsoDate, weekStartIso } from '../utils/formatting';

export interface DashboardData {
  urgentTasks: (TaskWithCategory & { overdue: number })[];
  activeProjects: Project[];
  recentNotes: Note[];
  completedToday: number;
  dueToday: number;
  pendingCount: number;
  secondsThisWeek: number;
  loadMs: number;
}

/** F5: every dashboard metric in one SQLite transaction. */
export async function getDashboardData(db: DbLike, now = new Date()): Promise<DashboardData> {
  const t0 = Date.now();
  const today = toIsoDate(now);
  const nowTime = toHHmm(now);
  const { start, end } = todayBoundsIso(now);
  const weekStart = weekStartIso(now);
  const out = {} as DashboardData;

  await db.withTransactionAsync(async () => {
    // Top 3 pending tasks that are High priority or overdue; overdue first, then earliest due.
    out.urgentTasks = await db.getAllAsync<TaskWithCategory & { overdue: number }>(
      `SELECT t.*, c.name AS category_name,
              (t.due_date IS NOT NULL AND (t.due_date < ? OR (t.due_date = ? AND t.due_time IS NOT NULL AND t.due_time < ?))) AS overdue
         FROM tasks t JOIN categories c ON c.id = t.category_id
        WHERE t.status != 'Completed'
          AND (t.priority = 'High' OR t.due_date < ? OR (t.due_date = ? AND t.due_time IS NOT NULL AND t.due_time < ?))
        ORDER BY overdue DESC, t.due_date IS NULL, t.due_date, t.due_time IS NULL, t.due_time, t.created_at
        LIMIT 3`,
      [today, today, nowTime, today, today, nowTime],
    );
    out.activeProjects = await db.getAllAsync<Project>(
      `SELECT * FROM projects WHERE status = 'Active' ORDER BY updated_at DESC LIMIT 5`,
    );
    out.recentNotes = await db.getAllAsync<Note>('SELECT * FROM notes ORDER BY updated_at DESC LIMIT 3');
    const stats = await db.getFirstAsync<{ completedToday: number; dueToday: number; pendingCount: number }>(
      `SELECT
         SUM(CASE WHEN status = 'Completed' AND updated_at BETWEEN ? AND ? THEN 1 ELSE 0 END) AS completedToday,
         SUM(CASE WHEN status != 'Completed' AND due_date = ? THEN 1 ELSE 0 END) AS dueToday,
         SUM(CASE WHEN status != 'Completed' THEN 1 ELSE 0 END) AS pendingCount
       FROM tasks`,
      [start, end, today],
    );
    const week = await db.getFirstAsync<{ s: number | null }>('SELECT SUM(duration_seconds) AS s FROM time_logs WHERE end_time >= ?', [
      weekStart,
    ]);
    out.completedToday = stats?.completedToday ?? 0;
    out.dueToday = stats?.dueToday ?? 0;
    out.pendingCount = stats?.pendingCount ?? 0;
    out.secondsThisWeek = week?.s ?? 0;
  });

  out.loadMs = Date.now() - t0;
  return out;
}
