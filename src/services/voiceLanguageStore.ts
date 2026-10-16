import { getSetting, setSetting } from '../database/settingsDao';
import type { DbLike } from '../database/types';
import { DEFAULT_VOICE_LANGUAGE, SETTINGS_KEYS, VOICE_LANGUAGES, type VoiceLanguage } from '../utils/constants';

const isVoiceLanguage = (v: string | null): v is VoiceLanguage => VOICE_LANGUAGES.some((l) => l.tag === v);

/** The dictation language chosen in Settings; English when unset or unknown. */
export async function loadVoiceLanguage(db: DbLike): Promise<VoiceLanguage> {
  const v = await getSetting(db, SETTINGS_KEYS.voiceLanguage);
  return isVoiceLanguage(v) ? v : DEFAULT_VOICE_LANGUAGE;
}

export async function saveVoiceLanguage(db: DbLike, lang: VoiceLanguage): Promise<void> {
  await setSetting(db, SETTINGS_KEYS.voiceLanguage, lang);
}
