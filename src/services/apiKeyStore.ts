import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { DbLike } from '../database/types';
import { getSetting, setSetting, deleteSetting } from '../database/settingsDao';
import { SETTINGS_KEYS } from '../utils/constants';
import { encryptString, decryptString, fromHex, toHex, type DigestFn } from '../utils/keyCipher';

const MASTER_KEY_ALIAS = 'mindpulse_master_key_v1';

const sha256: DigestFn = async (data) =>
  new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(data)));

async function getMasterKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(MASTER_KEY_ALIAS);
  if (existing) return fromHex(existing);
  const fresh = Crypto.getRandomBytes(32);
  await SecureStore.setItemAsync(MASTER_KEY_ALIAS, toHex(fresh));
  return fresh;
}

/** Encrypts the Anthropic key and stores the ciphertext in the SQLite settings table. */
export async function saveApiKey(db: DbLike, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    await deleteSetting(db, SETTINGS_KEYS.apiKeyCipher);
    return;
  }
  const blob = await encryptString(trimmed, await getMasterKey(), Crypto.getRandomBytes(16), sha256);
  await setSetting(db, SETTINGS_KEYS.apiKeyCipher, blob);
}

/** Returns the decrypted key, or null if none is saved (or it can no longer be decrypted). */
export async function loadApiKey(db: DbLike): Promise<string | null> {
  const blob = await getSetting(db, SETTINGS_KEYS.apiKeyCipher);
  if (!blob) return null;
  try {
    return await decryptString(blob, await getMasterKey(), sha256);
  } catch (e) {
    console.warn('Stored API key could not be decrypted; please re-enter it.', e);
    return null;
  }
}

export async function clearApiKey(db: DbLike): Promise<void> {
  await deleteSetting(db, SETTINGS_KEYS.apiKeyCipher);
}

/** sk-ant-api03-abc…wxyz */
export const maskApiKey = (key: string): string =>
  key.length <= 14 ? '••••' : `${key.slice(0, 10)}…${key.slice(-4)}`;
