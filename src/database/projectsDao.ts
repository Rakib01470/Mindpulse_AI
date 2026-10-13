import type { DbLike, Project, ProjectStatus, TimeLog } from './types';
import { ValidationError } from './types';
import { LIMITS, PROJECT_STATUSES } from '../utils/constants';
import { newId, nowIso } from '../utils/id';

export interface ProjectInput {
  title: string;
  description?: string | null;
  target_hours?: number;
  status?: ProjectStatus;
}

export const DEFAULT_TARGET_HOURS = 50;

/** Section 4 rules: title 1–100 chars, 0 < target_hours ≤ 10,000. */
export function validateProjectInput(input: ProjectInput) {
  const title = (input.title ?? '').replace(/\s+/g, ' ').trim();
  if (title.length < 1 || title.length > LIMITS.projectTitle) {
    throw new ValidationError(`Title must be 1–${LIMITS.projectTitle} characters.`);
  }
  const target_hours = input.target_hours ?? DEFAULT_TARGET_HOURS;
  if (!Number.isFinite(target_hours) || target_hours <= 0 || target_hours > LIMITS.maxTargetHours) {
    throw new ValidationError('Target hours must be greater than 0 and at most 10,000.');
  }
  const status = input.status ?? 'Active';
  if (!PROJECT_STATUSES.includes(status)) throw new ValidationError('Invalid project status.');
  return { title, description: input.description?.trim() || null, target_hours, status };
}

export async function getProjects(db: DbLike): Promise<Project[]> {
  return db.getAllAsync<Project>(
    `SELECT * FROM projects ORDER BY CASE status WHEN 'Active' THEN 0 WHEN 'On Hold' THEN 1 ELSE 2 END, updated_at DESC`,
  );
}

export async function getProject(db: DbLike, id: string): Promise<Project | null> {
  return db.getFirstAsync<Project>('SELECT * FROM projects WHERE id = ?', [id]);
}

export async function insertProject(db: DbLike, input: ProjectInput): Promise<Project> {
  const v = validateProjectInput(input);
  const now = nowIso();
  const p: Project = { id: newId('proj'), ...v, tracked_seconds: 0, created_at: now, updated_at: now };
  await db.runAsync(
    `INSERT INTO projects (id, title, description, target_hours, tracked_seconds, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [p.id, p.title, p.description, p.target_hours, p.status, p.created_at, p.updated_at],
  );
  return p;
}

export async function updateProject(db: DbLike, id: string, patch: Partial<ProjectInput>): Promise<Project> {
  const current = await getProject(db, id);
  if (!current) throw new ValidationError('Project not found.');
  const v = validateProjectInput({ ...current, ...patch });
  const updated: Project = { ...current, ...v, updated_at: nowIso() };
  await db.runAsync('UPDATE projects SET title = ?, description = ?, target_hours = ?, status = ?, updated_at = ? WHERE id = ?', [
    updated.title,
    updated.description,
    updated.target_hours,
    updated.status,
    updated.updated_at,
    id,
  ]);
  return updated;
}

/** Deletes the project and (via ON DELETE CASCADE) its session logs. */
export async function deleteProject(db: DbLike, id: string): Promise<void> {
  await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);
}

export interface SessionInput {
  project_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  notes?: string | null;
}

/** Writes a time_logs row and adds its duration to projects.tracked_seconds atomically (F3). */
export async function logSession(db: DbLike, s: SessionInput): Promise<TimeLog> {
  const duration = Math.round(s.duration_seconds);
  if (!Number.isInteger(duration) || duration <= 0) throw new ValidationError('Session duration must be greater than 0.');
  const project = await getProject(db, s.project_id);
  if (!project) throw new ValidationError('Project not found.');
  const log: TimeLog = {
    id: newId('log'),
    project_id: s.project_id,
    start_time: s.start_time,
    end_time: s.end_time,
    duration_seconds: duration,
    notes: s.notes?.trim() || null,
    created_at: nowIso(),
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO time_logs (id, project_id, start_time, end_time, duration_seconds, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [log.id, log.project_id, log.start_time, log.end_time, log.duration_seconds, log.notes, log.created_at],
    );
    await db.runAsync('UPDATE projects SET tracked_seconds = tracked_seconds + ?, updated_at = ? WHERE id = ?', [
      duration,
      log.created_at,
      s.project_id,
    ]);
  });
  return log;
}

/** Manual entry of past hours (F3): validates hours > 0; logged as ending now. */
export async function addManualTime(db: DbLike, projectId: string, hours: number, notes?: string | null, now = new Date()) {
  if (!Number.isFinite(hours) || hours <= 0) throw new ValidationError('Hours must be greater than 0.');
  if (hours > 24 * 31) throw new ValidationError('Enter at most 744 hours at a time.');
  const duration = Math.round(hours * 3600);
  return logSession(db, {
    project_id: projectId,
    start_time: new Date(now.getTime() - duration * 1000).toISOString(),
    end_time: now.toISOString(),
    duration_seconds: duration,
    notes: notes?.trim() ? notes : 'Manual entry',
  });
}

export async function getTimeLogs(db: DbLike, projectId: string): Promise<TimeLog[]> {
  return db.getAllAsync<TimeLog>('SELECT * FROM time_logs WHERE project_id = ? ORDER BY end_time DESC', [projectId]);
}

/** Removes a session and subtracts its time from the project total. */
export async function deleteTimeLog(db: DbLike, logId: string): Promise<void> {
  const log = await db.getFirstAsync<TimeLog>('SELECT * FROM time_logs WHERE id = ?', [logId]);
  if (!log) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM time_logs WHERE id = ?', [logId]);
    await db.runAsync('UPDATE projects SET tracked_seconds = MAX(0, tracked_seconds - ?), updated_at = ? WHERE id = ?', [
      log.duration_seconds,
      nowIso(),
      log.project_id,
    ]);
  });
}
