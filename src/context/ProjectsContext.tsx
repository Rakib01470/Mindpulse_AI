import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import type { Project, TimeLog } from '../database/types';
import * as dao from '../database/projectsDao';
import { deleteSetting, getSetting, setSetting } from '../database/settingsDao';
import { MESSAGES, SETTINGS_KEYS } from '../utils/constants';
import {
  elapsedSeconds,
  isRunning,
  parseTimer,
  pauseTimer,
  resumeTimer,
  serializeTimer,
  startTimer,
  type ActiveTimer,
} from '../utils/timer';
import { useDatabase } from './DatabaseContext';

interface ProjectsContextValue {
  projects: Project[];
  loading: boolean;
  refresh: () => Promise<void>;
  createProject: (input: dao.ProjectInput) => Promise<Project>;
  editProject: (id: string, patch: Partial<dao.ProjectInput>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  addManualTime: (projectId: string, hours: number, notes?: string) => Promise<void>;
  getLogs: (projectId: string) => Promise<TimeLog[]>;
  removeLog: (logId: string) => Promise<void>;
  /** Bumps whenever a session or manual entry is written (lets detail views reload logs). */
  logsVersion: number;
}

interface TimerContextValue {
  timer: ActiveTimer | null;
  running: boolean;
  elapsed: number;
  /** Set while the Stop dialog is open (timer is paused meanwhile). */
  stopping: boolean;
  /** Start a session; if another project's timer exists, asks to save it first (F3). */
  requestStart: (project: Project) => void;
  pause: () => void;
  resume: () => void;
  beginStop: () => void;
  cancelStop: () => void;
  confirmStop: (notes: string) => Promise<void>;
  discard: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);
const TimerContext = createContext<TimerContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { db, dataVersion } = useDatabase();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsVersion, setLogsVersion] = useState(0);
  const [timer, setTimerState] = useState<ActiveTimer | null>(null);
  const [now, setNow] = useState(Date.now());
  const [stopping, setStopping] = useState(false);
  const wasRunningBeforeStop = useRef(false);

  const refresh = useCallback(async () => {
    setProjects(await dao.getProjects(db));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh().catch((e) => console.error('Failed to load projects', e));
  }, [refresh, dataVersion]);

  // Restore a timer that was running when the app was closed.
  useEffect(() => {
    getSetting(db, SETTINGS_KEYS.activeTimer)
      .then((raw) => setTimerState(parseTimer(raw)))
      .catch(() => undefined);
  }, [db, dataVersion]);

  /** Updates state and persists so the session survives an app restart. */
  const setTimer = useCallback(
    (t: ActiveTimer | null) => {
      setTimerState(t);
      setNow(Date.now());
      (t ? setSetting(db, SETTINGS_KEYS.activeTimer, serializeTimer(t)) : deleteSetting(db, SETTINGS_KEYS.activeTimer)).catch((e) =>
        console.warn('Could not persist timer', e),
      );
    },
    [db],
  );

  // 1-second tick only while running; re-sync immediately when the app returns to the foreground.
  const running = isRunning(timer);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [running]);

  const commit = useCallback(
    async (t: ActiveTimer, notes: string | null) => {
      const end = Date.now();
      const paused = pauseTimer(t, end);
      const seconds = elapsedSeconds(paused, end);
      if (seconds > 0) {
        await dao.logSession(db, {
          project_id: t.projectId,
          start_time: t.sessionStart,
          end_time: new Date(end).toISOString(),
          duration_seconds: seconds,
          notes,
        });
      }
      setTimer(null);
      setLogsVersion((v) => v + 1);
      await refresh();
    },
    [db, refresh, setTimer],
  );

  const projectsValue = useMemo<ProjectsContextValue>(
    () => ({
      projects,
      loading,
      refresh,
      logsVersion,
      createProject: async (input) => {
        const p = await dao.insertProject(db, input);
        await refresh();
        return p;
      },
      editProject: async (id, patch) => {
        const p = await dao.updateProject(db, id, patch);
        if (timer?.projectId === id && p.title !== timer.projectTitle) setTimer({ ...timer, projectTitle: p.title });
        await refresh();
      },
      removeProject: async (id) => {
        if (timer?.projectId === id) setTimer(null);
        await dao.deleteProject(db, id);
        await refresh();
      },
      addManualTime: async (projectId, hours, notes) => {
        await dao.addManualTime(db, projectId, hours, notes);
        setLogsVersion((v) => v + 1);
        await refresh();
      },
      getLogs: (projectId) => dao.getTimeLogs(db, projectId),
      removeLog: async (logId) => {
        await dao.deleteTimeLog(db, logId);
        setLogsVersion((v) => v + 1);
        await refresh();
      },
    }),
    [projects, loading, refresh, logsVersion, db, timer, setTimer],
  );

  const timerValue = useMemo<TimerContextValue>(
    () => ({
      timer,
      running,
      elapsed: timer ? elapsedSeconds(timer, now) : 0,
      stopping,
      requestStart: (project) => {
        if (timer && timer.projectId === project.id) {
          if (!isRunning(timer)) setTimer(resumeTimer(timer, Date.now()));
          return;
        }
        if (timer) {
          Alert.alert('Timer already running', MESSAGES.timerRunning(timer.projectTitle), [
            { text: 'Cancel', style: 'cancel' },
            {
              text: `Save & start ${project.title}`,
              onPress: () => {
                commit(timer, null)
                  .then(() => setTimer(startTimer(project, Date.now())))
                  .catch((e) => Alert.alert('Could not save session', String(e)));
              },
            },
          ]);
          return;
        }
        setTimer(startTimer(project, Date.now()));
      },
      pause: () => timer && setTimer(pauseTimer(timer, Date.now())),
      resume: () => timer && setTimer(resumeTimer(timer, Date.now())),
      beginStop: () => {
        if (!timer) return;
        wasRunningBeforeStop.current = isRunning(timer);
        setTimer(pauseTimer(timer, Date.now()));
        setStopping(true);
      },
      cancelStop: () => {
        setStopping(false);
        if (timer && wasRunningBeforeStop.current) setTimer(resumeTimer(timer, Date.now()));
      },
      confirmStop: async (notes) => {
        if (!timer) return;
        setStopping(false);
        await commit(timer, notes);
      },
      discard: async () => {
        setStopping(false);
        setTimer(null);
      },
    }),
    [timer, running, now, stopping, setTimer, commit],
  );

  return (
    <ProjectsContext.Provider value={projectsValue}>
      <TimerContext.Provider value={timerValue}>{children}</TimerContext.Provider>
    </ProjectsContext.Provider>
  );
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used inside ProjectsProvider');
  return ctx;
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside ProjectsProvider');
  return ctx;
}
