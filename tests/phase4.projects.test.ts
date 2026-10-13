import { freshDb } from './helpers/nodeDb';
import * as dao from '../src/database/projectsDao';
import { getSetting, setSetting } from '../src/database/settingsDao';
import { elapsedSeconds, parseTimer, pauseTimer, resumeTimer, serializeTimer, startTimer, isRunning } from '../src/utils/timer';
import { formatProjectProgress, formatStopwatch, projectProgressRatio } from '../src/utils/formatting';
import { MESSAGES, SETTINGS_KEYS } from '../src/utils/constants';

describe('Phase 4 checkpoint — "Game Dev" (10 hrs), run 15 s, stop', () => {
  it('adds exactly 15 s, records the session and updates the progress percentage', async () => {
    const db = await freshDb();
    const project = await dao.insertProject(db, { title: 'Game Dev', target_hours: 10 });
    expect(project.tracked_seconds).toBe(0);

    // Start Timer at t0, Stop Timer 15 s later (same commit logic as ProjectsContext).
    const t0 = Date.UTC(2026, 9, 13, 14, 0, 0);
    let timer = startTimer(project, t0);
    expect(formatStopwatch(elapsedSeconds(timer, t0))).toBe('00:00:00');
    expect(formatStopwatch(elapsedSeconds(timer, t0 + 15_000))).toBe('00:00:15');
    timer = pauseTimer(timer, t0 + 15_000); // Stop → dialog open: timer frozen
    const later = t0 + 60_000; // user takes 45 s typing notes — must not count
    expect(elapsedSeconds(timer, later)).toBe(15);

    await dao.logSession(db, {
      project_id: project.id,
      start_time: timer.sessionStart,
      end_time: new Date(t0 + 15_000).toISOString(),
      duration_seconds: elapsedSeconds(timer, later),
      notes: 'Prototyped jump mechanic',
    });

    const after = await dao.getProject(db, project.id);
    expect(after?.tracked_seconds).toBe(15);
    const logs = await dao.getTimeLogs(db, project.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ duration_seconds: 15, notes: 'Prototyped jump mechanic', start_time: '2026-10-13T14:00:00.000Z' });
    expect(projectProgressRatio(after!.tracked_seconds, 10)).toBeCloseTo(15 / 36000, 10);
    expect(formatProjectProgress(after!.tracked_seconds, 10)).toBe('0 / 10 hrs (0%)');

    // A second, longer session moves the bar visibly.
    await dao.addManualTime(db, project.id, 2.5);
    const again = await dao.getProject(db, project.id);
    expect(again?.tracked_seconds).toBe(15 + 9000);
    expect(formatProjectProgress(again!.tracked_seconds, 10)).toBe('2.5 / 10 hrs (25%)');
    db.close();
  });
});

describe('Phase 4 — stopwatch engine', () => {
  const p = { id: 'proj_1', title: '3D Asset Dev' };

  it('keeps counting across navigation/backgrounding because it is wall-clock based', () => {
    const t = startTimer(p, 0);
    expect(elapsedSeconds(t, 3_725_000)).toBe(3725);
    expect(formatStopwatch(3725)).toBe('01:02:05');
  });

  it('pause/resume only counts running stretches', () => {
    let t = startTimer(p, 0);
    t = pauseTimer(t, 10_000);
    expect(isRunning(t)).toBe(false);
    expect(elapsedSeconds(t, 50_000)).toBe(10);
    t = resumeTimer(t, 50_000);
    expect(elapsedSeconds(t, 55_500)).toBe(15);
    expect(pauseTimer(pauseTimer(t, 60_000), 99_000)).toEqual(pauseTimer(t, 60_000));
  });

  it('persists to the settings table and restores after an app restart', async () => {
    const db = await freshDb();
    const t = startTimer(p, 1_000);
    await setSetting(db, SETTINGS_KEYS.activeTimer, serializeTimer(t));
    const restored = parseTimer(await getSetting(db, SETTINGS_KEYS.activeTimer));
    expect(restored).toEqual(t);
    expect(elapsedSeconds(restored!, 31_000)).toBe(30);
    expect(parseTimer('{"bad":true}')).toBeNull();
    expect(parseTimer('not json')).toBeNull();
    db.close();
  });

  it('single-timer conflict message matches Section 10', () => {
    expect(MESSAGES.timerRunning('3D Asset Dev')).toBe(
      "A timer is already running for '3D Asset Dev'. Pause or save current session first?",
    );
  });
});

describe('Phase 4 — project rules', () => {
  it('validates title and target hours (Section 4)', async () => {
    const db = await freshDb();
    await expect(dao.insertProject(db, { title: '' })).rejects.toThrow('Title must be');
    await expect(dao.insertProject(db, { title: 'x'.repeat(101) })).rejects.toThrow('Title must be');
    await expect(dao.insertProject(db, { title: 'X', target_hours: 0 })).rejects.toThrow('greater than 0');
    await expect(dao.insertProject(db, { title: 'X', target_hours: 10_001 })).rejects.toThrow('10,000');
    expect((await dao.insertProject(db, { title: 'Web Novel Writing' })).target_hours).toBe(50);
    db.close();
  });

  it('manual entry rejects non-positive hours', async () => {
    const db = await freshDb();
    const proj = await dao.insertProject(db, { title: 'X' });
    await expect(dao.addManualTime(db, proj.id, 0)).rejects.toThrow('greater than 0');
    await expect(dao.addManualTime(db, proj.id, -1)).rejects.toThrow('greater than 0');
    await expect(dao.logSession(db, { project_id: proj.id, start_time: 'a', end_time: 'b', duration_seconds: 0 })).rejects.toThrow();
    db.close();
  });

  it('deleting a session subtracts it; deleting a project cascades its logs', async () => {
    const db = await freshDb();
    const proj = await dao.insertProject(db, { title: 'X' });
    const log = await dao.addManualTime(db, proj.id, 1);
    await dao.addManualTime(db, proj.id, 0.5);
    await dao.deleteTimeLog(db, log.id);
    expect((await dao.getProject(db, proj.id))?.tracked_seconds).toBe(1800);
    await dao.deleteProject(db, proj.id);
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM time_logs');
    expect(n?.n).toBe(0);
    db.close();
  });

  it('formats the card string exactly like the spec example', () => {
    expect(formatProjectProgress(14.5 * 3600, 50)).toBe('14.5 / 50 hrs (29%)');
  });
});
