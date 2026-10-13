/** Unit + DAO integration tests. DAOs run against a real SQLite engine (node:sqlite). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', diagnostics: { warnOnly: false } }],
  },
  moduleNameMapper: {
    '^expo-file-system$': '<rootDir>/tests/stubs/expoStub.ts',
    '^expo-sharing$': '<rootDir>/tests/stubs/expoStub.ts',
    '^expo-document-picker$': '<rootDir>/tests/stubs/expoStub.ts',
    '^expo-secure-store$': '<rootDir>/tests/stubs/expoStub.ts',
    '^expo-crypto$': '<rootDir>/tests/stubs/expoStub.ts',
  },
  testTimeout: 20000,
};
