/**
 * Wrapper around expo-speech-recognition (Android SpeechRecognizer).
 * The native module is loaded lazily: in Expo Go it is absent and importing it would
 * throw at startup, so the app degrades to typed input instead (DECISIONS.md D-02).
 */
import { SPEECH_SILENCE_TIMEOUT_MS } from '../utils/constants';

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
  let heardSomething = false;
  let ended = false;
  const subs: { remove: () => void }[] = [];

  const cleanup = () => {
    clearTimeout(silenceTimer);
    subs.forEach((s) => s.remove());
    subs.length = 0;
  };

  // Section 10: give up after 5 s with no speech at all.
  const silenceTimer = setTimeout(() => {
    if (!heardSomething && !ended) {
      handlers.onError('no-speech', 'No speech detected');
      m.ExpoSpeechRecognitionModule.abort();
    }
  }, SPEECH_SILENCE_TIMEOUT_MS);

  subs.push(
    m.addSpeechRecognitionListener('speechstart', () => {
      heardSomething = true;
    }),
    m.addSpeechRecognitionListener('result', (ev) => {
      const text = ev.results[0]?.transcript?.trim() ?? '';
      if (text) heardSomething = true;
      if (ev.isFinal) {
        finalText = [finalText, text].filter(Boolean).join(' ');
        handlers.onTranscript(finalText, true);
      } else {
        handlers.onTranscript([finalText, text].filter(Boolean).join(' '), false);
      }
    }),
    m.addSpeechRecognitionListener('volumechange', (ev) => handlers.onVolume?.(ev.value)),
    m.addSpeechRecognitionListener('nomatch', () => {
      if (!finalText) handlers.onError('no-speech', 'No speech recognised');
    }),
    m.addSpeechRecognitionListener('error', (ev) => {
      const code = ev.error;
      if (code === 'aborted') return;
      if (code === 'no-speech' || code === 'speech-timeout') {
        if (!finalText) handlers.onError('no-speech', ev.message);
      } else if (code === 'not-allowed') handlers.onError('permission', ev.message);
      else if (code === 'network') handlers.onError('network', ev.message);
      else handlers.onError('other', `${code}: ${ev.message}`);
    }),
    m.addSpeechRecognitionListener('end', () => {
      if (ended) return;
      ended = true;
      cleanup();
      handlers.onEnd();
    }),
  );

  try {
    m.ExpoSpeechRecognitionModule.start({
      lang: opts.lang ?? 'en-US',
      interimResults: true,
      continuous: opts.continuous ?? false,
      addsPunctuation: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      androidIntentOptions: {
        EXTRA_PREFER_OFFLINE: true, // use the on-device model when it is installed (Section 2 #3)
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
      },
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
