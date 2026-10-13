import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Note } from '../database/types';
import * as dao from '../database/notesDao';
import { loadApiKey } from '../services/apiKeyStore';
import { fixGrammar } from '../services/aiService';
import { useDatabase } from './DatabaseContext';

interface NotesContextValue {
  notes: Note[];
  topics: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Insert (id null) or update; returns the saved note. */
  saveNote: (id: string | null, input: dao.NoteInput) => Promise<Note>;
  removeNote: (id: string) => Promise<void>;
  hasApiKey: () => Promise<boolean>;
  /** AI "Fix Grammar & Format" — throws AiError (missing_key | invalid_key | network | ...). */
  refineText: (text: string) => Promise<string>;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const { db, dataVersion } = useDatabase();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setNotes(await dao.getNotes(db));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh().catch((e) => console.error('Failed to load notes', e));
  }, [refresh, dataVersion]);

  const topics = useMemo(
    () => [...new Set(notes.map((n) => n.topic))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [notes],
  );

  const value = useMemo<NotesContextValue>(
    () => ({
      notes,
      topics,
      loading,
      refresh,
      saveNote: async (id, input) => {
        const saved = id ? await dao.updateNote(db, id, input) : await dao.insertNote(db, input);
        await refresh();
        return saved;
      },
      removeNote: async (id) => {
        await dao.deleteNote(db, id);
        await refresh();
      },
      hasApiKey: async () => !!(await loadApiKey(db)),
      refineText: async (text) => fixGrammar(text, { apiKey: await loadApiKey(db) }),
    }),
    [notes, topics, loading, refresh, db],
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used inside NotesProvider');
  return ctx;
}
