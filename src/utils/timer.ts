/**
 * Pure stopwatch engine. State is timestamps, not a ticking counter, so elapsed time
 * stays correct when the user switches tabs, backgrounds the app, or the app is killed
 * and restored from the persisted copy in the settings table.
 */
export interface ActiveTimer {
  projectId: string;
  projectTitle: string;
  /** ISO 8601 time the session was first started (time_logs.start_time). */
  sessionStart: string;
  /** Epoch ms when the current running stretch began; null while paused. */
  runningSince: number | null;
  /** Milliseconds banked from earlier running stretches. */
  accumulatedMs: number;
}

export const startTimer = (project: { id: string; title: string }, now: number): ActiveTimer => ({
  projectId: project.id,
  projectTitle: project.title,
  sessionStart: new Date(now).toISOString(),
  runningSince: now,
  accumulatedMs: 0,
});

export const isRunning = (t: ActiveTimer | null): boolean => !!t && t.runningSince !== null;

export const elapsedMs = (t: ActiveTimer, now: number): number =>
  t.accumulatedMs + (t.runningSince !== null ? Math.max(0, now - t.runningSince) : 0);

export const elapsedSeconds = (t: ActiveTimer, now: number): number => Math.floor(elapsedMs(t, now) / 1000);

export const pauseTimer = (t: ActiveTimer, now: number): ActiveTimer =>
  t.runningSince === null ? t : { ...t, accumulatedMs: elapsedMs(t, now), runningSince: null };

export const resumeTimer = (t: ActiveTimer, now: number): ActiveTimer =>
  t.runningSince !== null ? t : { ...t, runningSince: now };

export const serializeTimer = (t: ActiveTimer): string => JSON.stringify(t);

export function parseTimer(raw: string | null): ActiveTimer | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<ActiveTimer>;
    if (
      typeof o.projectId === 'string' &&
      typeof o.projectTitle === 'string' &&
      typeof o.sessionStart === 'string' &&
      typeof o.accumulatedMs === 'number' &&
      (o.runningSince === null || typeof o.runningSince === 'number')
    ) {
      return o as ActiveTimer;
    }
  } catch {
    // fall through
  }
  return null;
}
