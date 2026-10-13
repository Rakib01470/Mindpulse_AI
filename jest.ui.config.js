/**
 * UI integration tests: renders the real App (React Native renderer, jest-expo Android preset)
 * with expo-sqlite backed by Node's SQLite engine. Run: npx jest -c jest.ui.config.js
 */
module.exports = {
  preset: 'jest-expo/android',
  roots: ['<rootDir>/tests-ui'],
  setupFiles: ['<rootDir>/tests-ui/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native|react-native-paper|react-native-url-polyfill|@anthropic-ai/.*)',
  ],
  testTimeout: 90000,
};
