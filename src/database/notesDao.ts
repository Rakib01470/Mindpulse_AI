import type { DbLike, Note } from './types';
import { ValidationError } from './types';
import { LIMITS } from '../utils/constants';
import { newId, nowIso } from '../utils/id';

export interface NoteInput {
  topic?: string;
  title?: string;
  content: string;
}

/** Title used when the user leaves it blank: first line of the content, max 60 chars. */
export const deriveTitle = (content: string): string => {
  const first = content.trim().split('\n')[0].replace(/^[#*\-\s]+/, '').trim();
  if (!first) return 'Untitled note';
  return first.length > 60 ? `${first.slice(0, 57)}...` : first;
};

/** Section 4: topic 1–50 chars (default 'General'), content non-empty. */
export function validateNoteInput(input: NoteInput): Required<NoteInput> {
  const content = input.content ?? '';
  if (!content.trim()) throw new ValidationError('Note content cannot be empty.');
  const topic = (input.topic ?? '').replace(/\s+/g, ' ').trim() || 'General';
  if (topic.length > LIMITS.noteTopic) throw new ValidationError(`Topic must be 1–${LIMITS.noteTopic} characters.`);
  const title = (input.title ?? '').trim() || deriveTitle(content);
  return { topic, title: title.slice(0, 120), content };
}

export async function getNotes(db: DbLike): Promise<Note[]> {
  return db.getAllAsync<Note>('SELECT * FROM notes ORDER BY updated_at DESC');
}

export async function getNote(db: DbLike, id: string): Promise<Note | null> {
  return db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', [id]);
}

export async function getTopics(db: DbLike): Promise<string[]> {
  const rows = await db.getAllAsync<{ topic: string }>('SELECT DISTINCT topic FROM notes ORDER BY topic COLLATE NOCASE');
  return rows.map((r) => r.topic);
}

export async function insertNote(db: DbLike, input: NoteInput): Promise<Note> {
  const v = validateNoteInput(input);
  const now = nowIso();
  const note: Note = { id: newId('note'), ...v, created_at: now, updated_at: now };
  await db.runAsync('INSERT INTO notes (id, topic, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    note.id,
    note.topic,
    note.title,
    note.content,
    note.created_at,
    note.updated_at,
  ]);
  return note;
}

export async function updateNote(db: DbLike, id: string, input: NoteInput): Promise<Note> {
  const current = await getNote(db, id);
  if (!current) throw new ValidationError('Note not found.');
  const v = validateNoteInput(input);
  const updated: Note = { ...current, ...v, updated_at: nowIso() };
  await db.runAsync('UPDATE notes SET topic = ?, title = ?, content = ?, updated_at = ? WHERE id = ?', [
    updated.topic,
    updated.title,
    updated.content,
    updated.updated_at,
    id,
  ]);
  return updated;
}

export async function deleteNote(db: DbLike, id: string): Promise<void> {
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
}

/** Search bar filter (F4): matches topic, title or body, case-insensitive. */
export function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (n) => n.topic.toLowerCase().includes(q) || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
  );
}

/** Groups notes by topic for the accordion, topics alphabetical, notes newest first. */
export function groupByTopic(notes: Note[]): { topic: string; notes: Note[] }[] {
  const map = new Map<string, Note[]>();
  for (const n of notes) map.set(n.topic, [...(map.get(n.topic) ?? []), n]);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([topic, list]) => ({ topic, notes: list.sort((x, y) => y.updated_at.localeCompare(x.updated_at)) }));
}
