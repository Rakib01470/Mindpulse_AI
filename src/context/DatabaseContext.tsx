import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, Button } from 'react-native-paper';
import * as SQLite from 'expo-sqlite';
import type { DbLike, SqlValue } from '../database/types';
import { initDatabase } from '../database/db';
import { ThemeTokens } from '../utils/theme';

export const DB_NAME = 'mindpulse.db';

/** Adapts expo-sqlite's database object to the DAO interface. */
export function wrapExpoDb(db: SQLite.SQLiteDatabase): DbLike {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params: SqlValue[] = []) => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    getAllAsync: <T,>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T,>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

interface DatabaseContextValue {
  db: DbLike;
  /** Increments after a backup import so every context reloads from SQLite. */
  dataVersion: number;
  reloadAll: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DbLike | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SQLite.openDatabaseAsync(DB_NAME);
        const wrapped = wrapExpoDb(raw);
        await initDatabase(wrapped);
        if (!cancelled) setDb(wrapped);
      } catch (e) {
        console.error('Database init failed', e);
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reloadAll = useCallback(() => setDataVersion((v) => v + 1), []);
  const value = useMemo(() => (db ? { db, dataVersion, reloadAll } : null), [db, dataVersion, reloadAll]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="titleMedium" style={styles.text}>
          Could not open the local database.
        </Text>
        <Text style={styles.muted}>{error}</Text>
        <Button mode="contained" onPress={() => { setError(null); setAttempt((a) => a + 1); }} style={styles.btn}>
          Retry
        </Button>
      </View>
    );
  }
  if (!value) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used inside DatabaseProvider');
  return ctx;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ThemeTokens.spacing.lg,
    backgroundColor: ThemeTokens.colors.background,
  },
  text: { color: ThemeTokens.colors.textPrimary, textAlign: 'center' },
  muted: { color: ThemeTokens.colors.textMuted, marginTop: 8, textAlign: 'center' },
  btn: { marginTop: 16, minHeight: 48, justifyContent: 'center' },
});
