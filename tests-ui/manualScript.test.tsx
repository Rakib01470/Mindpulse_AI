/**
 * Section 9 "Manual Test Walkthrough Script", automated against the real UI.
 * Runs in Expo Go mode (no speech module) so dictation is typed; Anthropic is a fake fetch.
 */
// Must load first: installs the fake fetch before the Anthropic SDK captures global fetch.
import { alerts, chooseInNextAlert, fetchCalls, flush, goToTab, queueAnthropic } from './helpers';
import React from 'react';
import { DeviceEventEmitter, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import App from '../App';

const MSG = {
  empty: 'All caught up! Tap the microphone to add a task or start a project timer.',
  noSpeech: 'Voice recognition is not available in this build (Expo Go). Type your task below, or install the development build to dictate.',
  network: 'Network unavailable. Saved raw voice input to Task Title for manual editing.',
};

jest.setTimeout(120000);

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

it('runs the manual test script end to end', async () => {
  render(<App />);
  await waitFor(() => screen.getByText(MSG.empty));

  // 1. Fresh installation — default categories seeded.
  await goToTab('Settings');
  await waitFor(() => screen.getByText('Task Categories'));
  expect(screen.getByText('Office Work')).toBeTruthy();
  expect(screen.getByText('Personal Work')).toBeTruthy();

  // 2. API key setup → Test → "Valid Key".
  fireEvent.changeText(screen.getByLabelText('AI API key'), 'sk-ant-api03-TESTKEY-0000');
  await act(async () => fireEvent.press(screen.getByText('Save Key')));
  await waitFor(() => screen.getByText(/Saved \(encrypted on this device\)/));
  queueAnthropic({ text: 'OK' });
  await act(async () => fireEvent.press(screen.getByText('Test API Key')));
  await waitFor(() => screen.getByText('Valid Key'));
  expect(fetchCalls[0].url).toContain('/v1/messages');
  expect(fetchCalls[0].body.model).toBe('claude-haiku-5-5');

  // 3. Voice task capture (typed in Expo Go) → AI review card → Save Task.
  await goToTab('Dashboard');
  await act(async () => fireEvent.press(screen.getByLabelText('Capture task by voice')));
  await waitFor(() => screen.getByText(MSG.noSpeech));
  fireEvent.changeText(screen.getByPlaceholderText(/High priority office task/), 'High priority office task submit monthly branch compliance report by Friday 5 PM');
  queueAnthropic({
    text: '```json\n{"title":"Submit monthly branch compliance report","category_name":"Office Work","priority":"High","due_date":"2026-10-16","due_time":"17:00","summary":"Submit the monthly branch compliance report by Friday 5 PM."}\n```',
  });
  await act(async () => fireEvent.press(screen.getByText('Process with AI')));
  await waitFor(() => screen.getByText('Review AI-parsed task'));
  expect(screen.getByDisplayValue('Submit monthly branch compliance report')).toBeTruthy();
  expect(screen.getByText('16-10-2026')).toBeTruthy();
  expect(screen.getByText('05:00 PM')).toBeTruthy();
  expect(String(fetchCalls[1].body.system)).toContain('Existing task categories: "Office Work", "Personal Work"');
  await act(async () => fireEvent.press(screen.getByText('Save Task')));
  await waitFor(() => screen.getByText('Urgent Focus'));
  expect(screen.getByText('Submit monthly branch compliance report')).toBeTruthy();

  // 4. Offline fallback → banner + task saved with raw text as title.
  await act(async () => fireEvent.press(screen.getByLabelText('Capture task by voice')));
  await waitFor(() => screen.getByText(MSG.noSpeech));
  fireEvent.changeText(screen.getByPlaceholderText(/High priority office task/), 'call the auditor about vault keys');
  queueAnthropic({ networkError: true });
  queueAnthropic({ networkError: true }); // SDK retries once
  await act(async () => fireEvent.press(screen.getByText('Process with AI')));
  await waitFor(() => screen.getByText(MSG.network), { timeout: 15000 });
  expect(screen.getByText('Task saved locally')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Done')));

  // 5. Task progress → 100% auto-completes with strike-through.
  await goToTab('Tasks');
  await waitFor(() => screen.getByText('Call the auditor about vault keys'));
  // Default sort puts the High-priority task first, so the offline (Medium) task's slider is second.
  const slider = screen.getAllByLabelText('Task progress')[1];
  await act(async () => fireEvent(slider, 'slidingComplete', 100));
  await waitFor(() => {
    const title = screen.getByText('Call the auditor about vault keys');
    expect(StyleSheet.flatten(title.props.style).textDecorationLine).toBe('line-through');
  });
  expect(screen.getByText(/1 open · 1 completed/)).toBeTruthy();

  // 6. Project creation & live timer that survives tab switches.
  await goToTab('Projects');
  await act(async () => fireEvent.press(screen.getByText('New Project')));
  fireEvent.changeText(screen.getByLabelText('Project title'), '3D Asset Dev');
  fireEvent.changeText(screen.getByLabelText('Target hours'), '50');
  await act(async () => fireEvent.press(screen.getByText('Create Project')));
  await waitFor(() => screen.getByText('0 / 50 hrs (0%)'));
  await act(async () => fireEvent.press(screen.getByText('Start Session')));
  await waitFor(() => screen.getByText('Recording session'));
  await goToTab('Notes');
  expect(screen.getByText('Recording session')).toBeTruthy(); // sticky widget still there on Notes
  await flush(2300);
  expect(screen.getByText(/^00:00:0[2-3]$/)).toBeTruthy();
  await goToTab('Projects');
  await act(async () => fireEvent.press(screen.getByLabelText('Stop Timer')));
  await waitFor(() => screen.getByText('Stop session'));
  fireEvent.changeText(screen.getByLabelText('Session notes'), 'Blocked out sword mesh');
  await act(async () => fireEvent.press(screen.getByText('Save Session')));
  await waitFor(() => expect(screen.queryByText('Recording session')).toBeNull());
  expect(screen.getByText('0 / 50 hrs (0%)')).toBeTruthy();

  // 7. Notes & AI grammar fix → Accept → saved locally.
  await goToTab('Notes');
  await act(async () => fireEvent.press(screen.getByLabelText('New note')));
  await waitFor(() => screen.getByLabelText('Note text'));
  fireEvent.changeText(screen.getByLabelText('Note topic'), 'Web Novel');
  fireEvent.changeText(screen.getByLabelText('Note text'), 'i thinked about new game mechanic for jumping high');
  queueAnthropic({ text: 'I thought about a new game mechanic for jumping high.' });
  await act(async () => fireEvent.press(screen.getByText('Fix Grammar & Format')));
  await waitFor(() => screen.getByText('AI suggestions'));
  await act(async () => fireEvent.press(screen.getByText('Accept Changes')));
  await waitFor(() => screen.getByDisplayValue('I thought about a new game mechanic for jumping high.'));
  await waitFor(() => screen.getByText(/^Saved /));
  await act(async () => DeviceEventEmitter.emit('hardwareBackPress')); // Android back button
  await waitFor(() => screen.getByText('Web Novel (1)'));
  expect(screen.getAllByText('I thought about a new game mechanic for jumping high.').length).toBe(2); // derived title + preview

  // 8. Dashboard integrity: urgent task, project progress, recent note.
  await goToTab('Dashboard');
  await waitFor(() => screen.getByText('Recent Notes'));
  expect(screen.getByText('Urgent Focus')).toBeTruthy();
  expect(screen.getByText('Submit monthly branch compliance report')).toBeTruthy();
  expect(screen.getByText('Project Progress')).toBeTruthy();
  expect(screen.getByText('3D Asset Dev')).toBeTruthy();
  expect(screen.getByText('Resume Timer')).toBeTruthy();
  expect(screen.queryByText(MSG.empty)).toBeNull();

  // 9. Export backup → delete a task → import backup → task restored.
  await goToTab('Settings');
  await act(async () => fireEvent.press(screen.getByText('Export Data')));
  await waitFor(() => screen.getByText(/Exported mindpulse-backup-\d{4}-\d{2}-\d{2}\.json/));
  const files = (FileSystem as unknown as { __files: Map<string, string> }).__files;
  const [backupUri, backupJson] = [...files.entries()][0];
  expect(backupUri).toMatch(/mindpulse-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(Object.keys(JSON.parse(backupJson))).toEqual(expect.arrayContaining(['categories', 'tasks', 'projects', 'time_logs', 'notes']));
  expect(backupJson).not.toContain('sk-ant');

  await goToTab('Tasks');
  await act(async () => fireEvent.press(screen.getByLabelText('Open task Submit monthly branch compliance report')));
  await waitFor(() => screen.getByText('Save Changes'));
  chooseInNextAlert('Delete');
  await act(async () => fireEvent.press(screen.getByText('Delete')));
  await waitFor(() => expect(screen.queryByText('Submit monthly branch compliance report')).toBeNull());

  await goToTab('Settings');
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri: backupUri }] });
  chooseInNextAlert('Overwrite');
  await act(async () => fireEvent.press(screen.getByText('Import Data')));
  await waitFor(() => expect(alerts.some((a) => a.title === 'Restore complete')).toBe(true));
  expect(alerts.find((a) => a.title === 'Restore backup?')?.message).toContain('2 tasks, 1 projects, 1 sessions, 1 notes, 2 categories');
  await goToTab('Tasks');
  await waitFor(() => screen.getByText('Submit monthly branch compliance report'));

  // 9b. Corrupted backup → exact error, data kept.
  files.set('file:///cache/bad.json', '{"tasks": "nope"}');
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/bad.json' }] });
  await goToTab('Settings');
  await act(async () => fireEvent.press(screen.getByText('Import Data')));
  await waitFor(() => expect(alerts[alerts.length - 1]).toEqual({ title: 'Import failed', message: 'Invalid backup file format. Operation cancelled.' }));

  // 10. Custom category: create, add a task to it, delete it → task moves to Personal Work.
  await goToTab('Tasks');
  await act(async () => fireEvent.press(screen.getByText('Add Category')));
  fireEvent.changeText(screen.getByLabelText('Category name'), 'Consultation Work');
  await act(async () => fireEvent.press(screen.getByText('Add')));
  await waitFor(() => screen.getByText('Consultation Work'));
  // Duplicate (case-insensitive) is blocked.
  await act(async () => fireEvent.press(screen.getByText('Add Category')));
  fireEvent.changeText(screen.getByLabelText('Category name'), 'consultation work');
  await act(async () => fireEvent.press(screen.getByText('Add')));
  await waitFor(() => screen.getByText('Category already exists'));
  await act(async () => fireEvent.press(screen.getByText('Cancel')));

  await act(async () => fireEvent.press(screen.getByText('Consultation Work')));
  await act(async () => fireEvent.press(screen.getByLabelText('Add task manually')));
  await waitFor(() => screen.getByText('New Task'));
  fireEvent.changeText(screen.getByLabelText('Task title'), 'Client tax consultation');
  await act(async () => fireEvent.press(screen.getAllByText('Save Task')[0]));
  await waitFor(() => screen.getByText('Client tax consultation'));

  chooseInNextAlert('Delete');
  await act(async () => fireEvent(screen.getAllByText('Consultation Work')[0], 'longPress')); // the filter chip
  await waitFor(() =>
    expect(alerts.some((a) => a.message === "Delete category 'Consultation Work'? Associated tasks will be moved to 'Personal Work'.")).toBe(true),
  );
  await waitFor(() => expect(screen.queryByText('Consultation Work')).toBeNull());
  await act(async () => fireEvent.press(screen.getByText('All')));
  await waitFor(() => screen.getByText('Client tax consultation'));
  expect(screen.getAllByText('Personal Work').length).toBeGreaterThan(1); // filter chip + the moved task's pill

  // Session log check (from step 6).
  await goToTab('Projects');
  await act(async () => fireEvent.press(screen.getByLabelText('Open project 3D Asset Dev')));
  await waitFor(() => screen.getByText('Blocked out sword mesh'));
  expect(screen.getByText(/^[23]s$/)).toBeTruthy();
});
