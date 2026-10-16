/**
 * Wrapper around expo-speech-recognition (Android SpeechRecognizer).
 * The native module is loaded lazily: in Expo Go it is absent and importing it would
 * throw at startup, so the app degrades to typed input instead (DECISIONS.md D-02).
 */
import { Platform } from 'react-native';
import { DEFAULT_VOICE_LANGUAGE, SPEECH_SILENCE_TIMEOUT_MS } from '../utils/constants';

type SpeechPkg = typeof import('expo-speech-recognition');

let pkg: SpeechPkg | null | undefined;

function load(): SpeechPkg | null {
  if (pkg !== undefined) return pkg;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pkg = require('expo-speech-recognition') as SpeechPkg;
  } catch {
    pkg = null;
  }
  return pkg;
}

export function isSpeechAvailable(): boolean {
  const m = load();
  if (!m) return false;
  try {
    return m.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/** Requests RECORD_AUDIO (and recognizer) permission if not already granted. */
export async function ensureMicPermission(): Promise<boolean> {
  const m = load();
  if (!m) return false;
  const current = await m.ExpoSpeechRecognitionModule.getPermissionsAsync();
  if (current.granted) return true;
  const res = await m.ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return res.granted;
}

// Google's network-capable recognizers (Android 13+, then older Android). Phones whose default
// is another vendor's service (e.g. Samsung) often return "no speech" to third-party apps.
const PREFERRED_SERVICES = ['com.google.android.tts', 'com.google.android.googlequicksearchbox'];

function pickRecognitionService(m: SpeechPkg): string | undefined {
  if (Platform.OS !== 'android') return undefined;
  try {
    const available = m.ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
    return PREFERRED_SERVICES.find((p) => available.includes(p));
  } catch {
    return undefined;
  }
}

export type SpeechErrorKind = 'no-speech' | 'permission' | 'network' | 'unavailable' | 'other';

export interface DictationHandlers {
  /** Full transcript so far (finalised segments + current partial). */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Input level, roughly 0..10 (below 0 = silence). */
  onVolume?: (value: number) => void;
  onError: (kind: SpeechErrorKind, message: string) => void;
  /** Recognition ended (after stop, abort, error, or natural end of speech). */
  onEnd: () => void;
}

export interface DictationSession {
  stop: () => void;
  abort: () => void;
}

export function startDictation(
  handlers: DictationHandlers,
  opts: { continuous?: boolean; lang?: string } = {},
): DictationSession {
  const m = load();
  if (!m) {
    handlers.onError('unavailable', 'Speech recognition module not available');
    handlers.onEnd();
    return { stop: () => undefined, abort: () => undefined };
  }

  let finalText = '';
  let partialText = '';
  let heardSomething = false;
  let ended = false;
  const subs: { remove: () => void }[] = [];
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    clearTimeout(silenceTimer);
    subs.forEach((s) => s.remove());
    subs.length = 0;
  };

  // Call addListener on the module itself. The package's addSpeechRecognitionListener export is a
  // detached copy of it; under the New Architecture it loses `this`, and no event ever arrives.
  const speech = m.ExpoSpeechRecognitionModule;
  const service = pickRecognitionService(m);
  const via = service ?? 'default recognizer';

  // Section 10: give up after 5 s with no speech at all. Counted from the "start" event,
  // not from start(): the recognizer can take a second or two to begin listening.
  subs.push(
    speech.addListener('start', () => {
      silenceTimer = setTimeout(() => {
        if (!heardSomething && !ended) {
          handlers.onError('no-speech', `no sound heard, ${via}`);
          m.ExpoSpeechRecognitionModule.abort();
        }
      }, SPEECH_SILENCE_TIMEOUT_MS);
    }),
    speech.addListener('speechstart', () => {
      heardSomething = true;
    }),
    speech.addListener('result', (ev) => {
      const text = ev.results[0]?.transcript?.trim() ?? '';
      if (text) heardSomething = true;
      if (ev.isFinal) {
        finalText = [finalText, text].filter(Boolean).join(' ');
        partialText = '';
        handlers.onTranscript(finalText, true);
      } else {
        partialText = text;
        handlers.onTranscript([finalText, text].filter(Boolean).join(' '), false);
      }
    }),
    speech.addListener('volumechange', (ev) => {
      // Not every recognizer sends "speechstart"; a clear input level means the mic hears the user.
      if (ev.value > 1) heardSomething = true;
      handlers.onVolume?.(ev.value);
    }),
    speech.addListener('error', (ev) => {
      const code = ev.error;
      if (code === 'aborted') return;
      if (code === 'no-speech' || code === 'speech-timeout') {
        // Google's recognizer can stream partial words and then return an empty final result
        // (e.g. speech in another language). Keep what it showed instead of discarding it.
        if (partialText) {
          finalText = [finalText, partialText].filter(Boolean).join(' ');
          partialText = '';
          handlers.onTranscript(finalText, true);
        } else if (!finalText) handlers.onError('no-speech', `${code}: ${ev.message}, ${via}`);
      } else if (code === 'not-allowed') handlers.onError('permission', ev.message);
      else if (code === 'network') handlers.onError('network', ev.message);
      else handlers.onError('other', `${code}: ${ev.message}, ${via}`);
    }),
    speech.addListener('end', () => {
      if (ended) return;
      ended = true;
      cleanup();
      handlers.onEnd();
    }),
  );

  try {
    m.ExpoSpeechRecognitionModule.start({
      lang: opts.lang ?? DEFAULT_VOICE_LANGUAGE,
      interimResults: true,
      continuous: opts.continuous ?? false,
      addsPunctuation: true,
      androidRecognitionServicePackage: service,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      // No androidIntentOptions (DECISIONS.md D-12, D-13). EXTRA_PREFER_OFFLINE makes Google's
      // recognizer answer "no match" without the offline pack, and on Android 16 it applies
      // EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS before speech starts too, closing the
      // mic 2 s after it opens. Its default end-of-speech pause is used instead.
    });
  } catch (e) {
    cleanup();
    handlers.onError('other', e instanceof Error ? e.message : String(e));
    handlers.onEnd();
  }

  return {
    stop: () => m.ExpoSpeechRecognitionModule.stop(),
    abort: () => {
      ended = true;
      cleanup();
      m.ExpoSpeechRecognitionModule.abort();
    },
  };
}
