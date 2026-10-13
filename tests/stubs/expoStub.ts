/** Minimal stand-ins for Expo native modules that the pure logic under test never calls. */
const notInTests = () => {
  throw new Error('Native Expo module is not available in unit tests');
};
export const cacheDirectory = '/tmp/';
export const writeAsStringAsync = notInTests;
export const readAsStringAsync = notInTests;
export const shareAsync = notInTests;
export const getDocumentAsync = notInTests;
export const getItemAsync = notInTests;
export const setItemAsync = notInTests;
export const getRandomBytes = notInTests;
export const digest = notInTests;
export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
export const EncodingType = { UTF8: 'utf8' };
export default {};
export const isAvailableAsync = notInTests;
