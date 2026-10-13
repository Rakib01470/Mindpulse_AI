/* eslint-disable @typescript-eslint/no-require-imports */
// expo-sqlite → real SQLite (node:sqlite) behind the same async API the app uses.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  return {
    openDatabaseAsync: async () => {
      const db = new DatabaseSync(':memory:');
      return {
        execAsync: async (sql: string) => db.exec(sql),
        runAsync: async (sql: string, params: unknown[] = []) => {
          const r = db.prepare(sql).run(...params);
          return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
        },
        getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...params),
        getFirstAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).get(...params) ?? null,
        withTransactionAsync: async (task: () => Promise<void>) => {
          db.exec('BEGIN');
          try {
            await task();
            db.exec('COMMIT');
          } catch (e) {
            db.exec('ROLLBACK');
            throw e;
          }
        },
      };
    },
  };
});

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
  };
});

jest.mock('expo-crypto', () => {
  const nodeCrypto = require('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: async (_alg: string, data: Uint8Array) => {
      const buf = nodeCrypto.createHash('sha256').update(Buffer.from(data)).digest();
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
    getRandomBytes: (n: number) => new Uint8Array(nodeCrypto.randomBytes(n)),
  };
});

// Simulate Expo Go: the speech native module is missing.
jest.mock('expo-speech-recognition', () => {
  throw new Error("Cannot find native module 'ExpoSpeechRecognition'");
});

jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  return {
    cacheDirectory: 'file:///cache/',
    EncodingType: { UTF8: 'utf8' },
    writeAsStringAsync: jest.fn(async (uri: string, s: string) => void files.set(uri, s)),
    readAsStringAsync: jest.fn(async (uri: string) => files.get(uri) ?? ''),
    __files: files,
  };
});
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

// Native date picker: "pick" whatever globalThis.__pickDate holds (tests set it).
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: {
    open: jest.fn(({ onChange }: { onChange: (e: { type: string }, d?: Date) => void }) => {
      const d = (globalThis as { __pickDate?: Date }).__pickDate;
      onChange({ type: d ? 'set' : 'dismissed' }, d);
    }),
  },
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-font', () => ({
  isLoaded: () => true,
  isLoading: () => false,
  loadAsync: async () => undefined,
  useFonts: () => [true, null],
}));
