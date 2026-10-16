import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Banner, Button, IconButton, Surface, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Mic, Square, X } from 'lucide-react-native';
import { useDatabase } from '../../context/DatabaseContext';
import { emptyDraft, useTasks, type TaskDraft } from '../../context/TasksContext';
import { loadApiKey } from '../../services/apiKeyStore';
import { AiError, fallbackTask, parseTaskFromTranscript, type ParsedTask } from '../../services/aiService';
import { ensureMicPermission, isSpeechAvailable, startDictation, type DictationSession } from '../../services/speechService';
import { ValidationError } from '../../database/types';
import { MESSAGES } from '../../utils/constants';
import { ThemeTokens } from '../../utils/theme';
import { WaveformVisualizer } from './WaveformVisualizer';
import { ParsingCard, ParsingIndicator } from './ParsingCard';

const c = ThemeTokens.colors;

type Phase = 'listening' | 'idle' | 'processing' | 'review' | 'saved';
type BannerState = { text: string; tone: 'warn' | 'error' | 'info' } | null;

interface Props {
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
}

const toDraft = (p: ParsedTask): TaskDraft => emptyDraft({ ...p });

/**
 * F1 — Voice Capture Overlay. listening → (speech ends | Stop & Process) → processing
 * → review card → Save Task. Falls back to typed input where speech is unavailable.
 */
export function VoiceOverlay({ onClose, onOpenTask }: Props) {
  const { db } = useDatabase();
  const { categories, addTask } = useTasks();
  const categoryNames = categories.map((cat) => cat.name);

  const speechAvailable = useRef(isSpeechAvailable()).current;
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const [volume, setVolume] = useState(-2);
  const [banner, setBanner] = useState<BannerState>(
    speechAvailable ? null : { text: MESSAGES.speechUnavailable, tone: 'info' },
  );
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft());
  const [aiFilled, setAiFilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [savedTaskId, setSavedTaskId] = useState<string | null>(null);
  const session = useRef<DictationSession | null>(null);
  const processOnEnd = useRef(true);
  const mounted = useRef(true);

  const updateTranscript = (t: string) => {
    transcriptRef.current = t;
    setTranscript(t);
  };

  const review = (parsed: ParsedTask, fromAi: boolean) => {
    setDraft(toDraft(parsed));
    setAiFilled(fromAi);
    setPhase('review');
  };

  const process = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) {
        setPhase('idle');
        setBanner({ text: MESSAGES.noSpeech, tone: 'warn' });
        return;
      }
      setPhase('processing');
      const apiKey = await loadApiKey(db);
      if (!apiKey) {
        setBanner({ text: MESSAGES.apiKeyMissing, tone: 'warn' });
        review(fallbackTask(text), false);
        return;
      }
      try {
        const parsed = await parseTaskFromTranscript(text, { apiKey, categories: categoryNames });
        if (!mounted.current) return;
        setBanner(null);
        review(parsed, true);
      } catch (e) {
        if (!mounted.current) return;
        const kind = e instanceof AiError ? e.kind : 'other';
        if (kind === 'network') {
          // F1 acceptance: create the task locally with the raw dictation as its title.
          try {
            const id = await addTask(toDraft(fallbackTask(text)));
            setSavedTaskId(id);
            setPhase('saved');
            setBanner({ text: MESSAGES.networkFallback, tone: 'warn' });
          } catch (err) {
            setBanner({ text: `Could not save task: ${(err as Error).message}`, tone: 'error' });
            review(fallbackTask(text), false);
          }
          return;
        }
        setBanner({
          text:
            kind === 'invalid_key'
              ? MESSAGES.apiKeyInvalid
              : kind === 'rate_limited'
                ? MESSAGES.rateLimited
                : 'AI could not parse this task. Please review the fields below.',
          tone: kind === 'invalid_key' ? 'error' : 'warn',
        });
        review(fallbackTask(text), false);
      }
    },
    // categoryNames changes identity each render; categories is the stable source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, categories, addTask],
  );

  const startListening = useCallback(async () => {
    if (!speechAvailable) return;
    const granted = await ensureMicPermission().catch(() => false);
    if (!granted) {
      setBanner({ text: MESSAGES.audioPermission, tone: 'error' });
      Alert.alert('Microphone access needed', MESSAGES.audioPermission, [
        { text: 'Type instead', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      setPhase('idle');
      return;
    }
    setBanner(null);
    updateTranscript('');
    processOnEnd.current = true;
    setPhase('listening');
    session.current = startDictation({
      onTranscript: (t) => updateTranscript(t),
      onVolume: setVolume,
      onError: (kind, message) => {
        if (kind === 'no-speech') {
          processOnEnd.current = false;
          // The detail (error code and recognizer) says why, e.g. a missing speech service.
          setBanner({ text: `${MESSAGES.noSpeech}
(${message})`, tone: 'warn' });
        } else if (kind === 'permission') {
          processOnEnd.current = false;
          setBanner({ text: MESSAGES.audioPermission, tone: 'error' });
        } else if (kind === 'network') {
          setBanner({ text: 'Speech service needs a connection or an offline language pack. You can type the task instead.', tone: 'warn' });
        } else {
          setBanner({ text: `Speech recognition failed (${message}). You can type the task instead.`, tone: 'warn' });
        }
      },
      onEnd: () => {
        session.current = null;
        setVolume(-2);
        if (!mounted.current) return;
        if (processOnEnd.current && transcriptRef.current.trim()) {
          void process(transcriptRef.current);
        } else {
          setPhase('idle');
        }
      },
    });
  }, [speechAvailable, process]);

  useEffect(() => {
    mounted.current = true;
    void startListening();
    return () => {
      mounted.current = false;
      session.current?.abort();
    };
    // Start once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAndProcess = () => {
    if (session.current) {
      processOnEnd.current = true;
      session.current.stop(); // onEnd will process the final transcript
    } else {
      void process(transcriptRef.current);
    }
  };

  const onSave = async () => {
    setTitleError(null);
    setSaving(true);
    try {
      await addTask(draft);
      onClose();
    } catch (e) {
      if (e instanceof ValidationError) setTitleError(e.message);
      else setBanner({ text: `Could not save task: ${(e as Error).message}`, tone: 'error' });
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const bannerColor = banner?.tone === 'error' ? c.priorityHigh : banner?.tone === 'warn' ? c.priorityMedium : c.accent;

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.topBar}>
        <Text variant="titleLarge" style={styles.title}>
          Voice Capture
        </Text>
        <IconButton icon={({ size }) => <X color={c.textPrimary} size={size} />} onPress={onClose} size={28} accessibilityLabel="Close" />
      </View>
      <Banner
        visible={!!banner}
        icon={({ size }) => <AlertTriangle color={bannerColor} size={size} />}
        style={styles.banner}
        actions={banner ? [{ label: 'Dismiss', onPress: () => setBanner(null) }] : []}
      >
        <Text style={{ color: c.textPrimary }}>{banner?.text ?? ''}</Text>
      </Banner>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {phase === 'listening' || phase === 'idle' ? (
            <>
              {speechAvailable ? <WaveformVisualizer active={phase === 'listening'} volume={volume} /> : null}
              <Surface style={styles.transcriptBox} elevation={1}>
                <Text variant="labelMedium" style={styles.muted}>
                  {phase === 'listening' ? 'Listening… speak your task' : speechAvailable ? 'Transcript (you can edit it)' : 'Type your task'}
                </Text>
                {phase === 'listening' ? (
                  <Text variant="titleMedium" style={styles.transcript}>
                    {transcript || '…'}
                  </Text>
                ) : (
                  <TextInput
                    mode="flat"
                    value={transcript}
                    onChangeText={updateTranscript}
                    multiline
                    placeholder="e.g. High priority office task submit quarterly tax report by tomorrow 3 PM"
                    style={styles.transcriptInput}
                  />
                )}
              </Surface>
              <View style={styles.actions}>
                {phase === 'listening' ? (
                  <Button mode="contained" icon={({ color }) => <Square color={color} size={18} />} onPress={stopAndProcess} style={styles.bigBtn} contentStyle={styles.bigBtnContent}>
                    Stop & Process
                  </Button>
                ) : (
                  <>
                    {speechAvailable ? (
                      <Button mode="outlined" icon={({ color }) => <Mic color={color} size={18} />} onPress={startListening} style={styles.bigBtn} contentStyle={styles.bigBtnContent}>
                        Tap to dictate
                      </Button>
                    ) : null}
                    <Button mode="contained" onPress={stopAndProcess} disabled={!transcript.trim()} style={styles.bigBtn} contentStyle={styles.bigBtnContent}>
                      Process with AI
                    </Button>
                  </>
                )}
              </View>
            </>
          ) : null}

          {phase === 'processing' ? <ParsingIndicator /> : null}

          {phase === 'review' ? (
            <ParsingCard
              draft={draft}
              onChange={setDraft}
              categories={categoryNames}
              aiFilled={aiFilled}
              saving={saving}
              titleError={titleError}
              onSave={onSave}
              onDiscard={onClose}
            />
          ) : null}

          {phase === 'saved' ? (
            <Surface style={styles.transcriptBox} elevation={1}>
              <View style={styles.savedRow}>
                <CheckCircle2 color={c.success} size={22} />
                <Text variant="titleMedium" style={styles.transcript}>
                  Task saved locally
                </Text>
              </View>
              <Text style={styles.muted}>{transcript}</Text>
              <View style={styles.actions}>
                <Button mode="outlined" onPress={() => savedTaskId && onOpenTask(savedTaskId)} style={styles.bigBtn}>
                  Edit Task
                </Button>
                <Button mode="contained" onPress={onClose} style={styles.bigBtn}>
                  Done
                </Button>
              </View>
            </Surface>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16 },
  title: { color: c.textPrimary, fontWeight: '700' },
  banner: { backgroundColor: c.surfaceVariant },
  content: { padding: ThemeTokens.spacing.md, gap: ThemeTokens.spacing.md, paddingBottom: 48 },
  transcriptBox: { borderRadius: ThemeTokens.roundness, padding: ThemeTokens.spacing.md, backgroundColor: c.surface, gap: 8 },
  transcript: { color: c.textPrimary },
  transcriptInput: { backgroundColor: 'transparent', minHeight: 96 },
  muted: { color: c.textMuted },
  actions: { gap: 10, marginTop: 8 },
  bigBtn: { minHeight: 52, justifyContent: 'center' },
  bigBtnContent: { minHeight: 52 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
