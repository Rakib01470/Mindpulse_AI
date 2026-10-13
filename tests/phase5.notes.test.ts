import Anthropic from '@anthropic-ai/sdk';
import { freshDb } from './helpers/nodeDb';
import * as dao from '../src/database/notesDao';
import { fixGrammar, type AiClient } from '../src/services/aiService';
import { wordDiff } from '../src/utils/wordDiff';
import { MESSAGES } from '../src/utils/constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Phase 5 checkpoint — "i thinked about new game mechanic for jumping high"', () => {
  it('fix → accept → note content replaced and updated_at logged', async () => {
    const db = await freshDb();
    const draft = 'i thinked about new game mechanic for jumping high';
    const note = await dao.insertNote(db, { topic: 'Game Dev', content: draft });
    expect(note.title).toBe('i thinked about new game mechanic for jumping high');

    const client: AiClient = { complete: async () => 'I thought about a new game mechanic for jumping high.' };
    const refined = await fixGrammar(note.content, { apiKey: 'k', client });
    expect(refined).toBe('I thought about a new game mechanic for jumping high.');

    const diff = wordDiff(draft, refined)!;
    expect(diff.filter((p) => p.type === 'removed').map((p) => p.text.trim())).toEqual(
      expect.arrayContaining(['i', 'thinked']),
    );
    expect(diff.filter((p) => p.type === 'added').map((p) => p.text.trim()).join(' ')).toContain('thought');

    await sleep(5);
    const accepted = await dao.updateNote(db, note.id, { ...note, content: refined });
    const stored = await dao.getNote(db, note.id);
    expect(stored?.content).toBe('I thought about a new game mechanic for jumping high.');
    expect(stored!.updated_at > note.updated_at).toBe(true);
    expect(accepted.created_at).toBe(note.created_at);
    db.close();
  });

  it('offline grammar fix surfaces as a network error (UI shows the F4 toast)', async () => {
    const client: AiClient = {
      complete: async () => {
        throw new Anthropic.APIConnectionError({ message: 'Connection error.' });
      },
    };
    await expect(fixGrammar('text', { apiKey: 'k', client })).rejects.toMatchObject({ kind: 'network' });
    expect(MESSAGES.grammarOffline).toBe('Internet required for AI grammar correction.');
  });
});

describe('Phase 5 — notes rules', () => {
  it('validates topic and content (Section 4) and derives a title', async () => {
    const db = await freshDb();
    await expect(dao.insertNote(db, { content: '   ' })).rejects.toThrow('cannot be empty');
    await expect(dao.insertNote(db, { content: 'x', topic: 't'.repeat(51) })).rejects.toThrow('Topic must be');
    const n = await dao.insertNote(db, { content: '# Plot twist idea\nThe mentor is the villain.' });
    expect(n).toMatchObject({ topic: 'General', title: 'Plot twist idea' });
    db.close();
  });

  it('auto-save path: insert once, then update the same row (no duplicates)', async () => {
    const db = await freshDb();
    let id: string | null = null;
    for (const text of ['first draft', 'first draft, more', 'first draft, more, final']) {
      const saved: Awaited<ReturnType<typeof dao.insertNote>> = id
        ? await dao.updateNote(db, id, { topic: 'Novel Ideas', content: text })
        : await dao.insertNote(db, { topic: 'Novel Ideas', content: text });
      id = saved.id;
    }
    const all = await dao.getNotes(db);
    expect(all).toHaveLength(1);
    expect(all[0].content).toBe('first draft, more, final');
    db.close();
  });

  it('search filters by topic/title/body; accordion groups by topic', async () => {
    const db = await freshDb();
    await dao.insertNote(db, { topic: '3D Art', content: 'Retopology checklist' });
    await dao.insertNote(db, { topic: 'Novel Ideas', content: 'Chapter 4 cliffhanger' });
    await dao.insertNote(db, { topic: 'Bank Work', content: 'KYC refresh steps' });
    const all = await dao.getNotes(db);
    expect(dao.filterNotes(all, 'novel').map((n) => n.topic)).toEqual(['Novel Ideas']);
    expect(dao.filterNotes(all, 'kyc').map((n) => n.topic)).toEqual(['Bank Work']);
    expect(dao.groupByTopic(all).map((g) => g.topic)).toEqual(['3D Art', 'Bank Work', 'Novel Ideas']);
    expect(await dao.getTopics(db)).toEqual(['3D Art', 'Bank Work', 'Novel Ideas']);
    db.close();
  });
});

describe('Phase 5 — word diff', () => {
  it('re-joins to the exact originals', () => {
    const a = 'the quick  brown fox\njumps';
    const b = 'The quick brown fox\n\njumped.';
    const d = wordDiff(a, b)!;
    expect(d.filter((p) => p.type !== 'added').map((p) => p.text).join('')).toBe(a);
    expect(d.filter((p) => p.type !== 'removed').map((p) => p.text).join('')).toBe(b);
  });
  it('gives up (null) on very large inputs', () => {
    expect(wordDiff('a '.repeat(2000), 'b '.repeat(2000))).toBeNull();
  });
});
