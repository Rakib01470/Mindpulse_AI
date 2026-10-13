import type { PRIORITIES, TASK_STATUSES, PROJECT_STATUSES } from '../utils/constants';

export type SqlValue = string | number | null;

/**
 * The subset of expo-sqlite's SQLiteDatabase that the DAO layer uses.
 * Keeping DAOs on this interface lets the same SQL run against node:sqlite in tests.
 */
export interface DbLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlValue[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export type Priority = (typeof PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Category {
  id: string;
  name: string;
  is_system: number;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  category_id: string;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  summary: string | null;
  details: string | null;
  progress_percent: number;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

/** Task joined with its category name, as returned by list queries. */
export interface TaskWithCategory extends Task {
  category_name: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  target_hours: number;
  tracked_seconds: number;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  project_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  notes: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  topic: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
