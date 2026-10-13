import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Category, Priority, TaskWithCategory } from '../database/types';
import * as dao from '../database/tasksDao';
import { useDatabase } from './DatabaseContext';

/** A task as edited in forms: category referenced by name so the AI can suggest new ones. */
export interface TaskDraft {
  title: string;
  category_name: string;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  summary: string | null;
  details: string | null;
  progress_percent: number;
}

interface TasksContextValue {
  tasks: TaskWithCategory[];
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
  addTask: (draft: TaskDraft) => Promise<string>;
  saveTask: (id: string, draft: TaskDraft) => Promise<void>;
  setProgress: (id: string, percent: number) => Promise<void>;
  setCompleted: (id: string, completed: boolean) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<Category>;
  removeCategory: (id: string) => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { db, dataVersion } = useDatabase();
  const [tasks, setTasks] = useState<TaskWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [t, c] = await Promise.all([dao.getTasks(db), dao.getCategories(db)]);
    setTasks(t);
    setCategories(c);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh().catch((e) => console.error('Failed to load tasks', e));
  }, [refresh, dataVersion]);

  const toInput = useCallback(
    async (d: TaskDraft): Promise<dao.TaskInput> => {
      const cat = await dao.findOrCreateCategoryByName(db, d.category_name);
      return { ...d, category_id: cat.id };
    },
    [db],
  );

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks,
      categories,
      loading,
      refresh,
      addTask: async (draft) => {
        const t = await dao.insertTask(db, await toInput(draft));
        await refresh();
        return t.id;
      },
      saveTask: async (id, draft) => {
        await dao.updateTask(db, id, await toInput(draft));
        await refresh();
      },
      setProgress: async (id, percent) => {
        // Optimistic update so the slider and strike-through react immediately.
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, progress_percent: percent, status: dao.statusForProgress(percent) } : t)),
        );
        await dao.updateProgress(db, id, percent);
        await refresh();
      },
      setCompleted: async (id, completed) => {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, status: completed ? 'Completed' : 'Pending', progress_percent: completed ? 100 : 0 } : t,
          ),
        );
        await dao.setTaskCompleted(db, id, completed);
        await refresh();
      },
      removeTask: async (id) => {
        await dao.deleteTask(db, id);
        await refresh();
      },
      addCategory: async (name) => {
        const c = await dao.insertCategory(db, name);
        await refresh();
        return c;
      },
      removeCategory: async (id) => {
        await dao.deleteCategory(db, id);
        await refresh();
      },
    }),
    [tasks, categories, loading, refresh, db, toInput],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used inside TasksProvider');
  return ctx;
}

export const emptyDraft = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
  title: '',
  category_name: 'Office Work',
  priority: 'Medium',
  due_date: null,
  due_time: null,
  summary: null,
  details: null,
  progress_percent: 0,
  ...overrides,
});
