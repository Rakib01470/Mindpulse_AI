import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, Snackbar, Text, TextInput } from 'react-native-paper';
import { Mic, MicOff, Sparkles, Trash2 } from 'lucide-react-native';
import { useNotes } from '../../context/NotesContext';
import { AiError } from '../../services/aiService';
import { ensureMicPermission, isSpeechAvailable, startDictation, type DictationSession } from '../../services/speechService';
import { FilterChip } from '../common/FilterChip';
import { GrammarDiffModal } from './GrammarDiffModal';
import { LIMITS, MESSAGES, NOTE_AUTOSAVE_MS } from '../../utils/constants';
import { formatTime12, toHHmm } from '../../utils/formatting';
import { MIN_TOUCH, ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

interface Props {
  noteId?: string;
  initialTopic?: string;
  /** Lets the screen flush pending edits before navigating away. */
  registerFlush: (flush: () => Promise<void>) => void;
  onDeleted: () => void;
}

export function NoteEditor({ noteId: initialId, initialTopic, registerFlush, onDeleted }: Props) {
  const { notes, topics, saveNote, removeNote, hasApiKey, refineText } = useNotes();
  const existing = initialId ? notes.find((n) => n.id === initialId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [topic, setTopic] = useState(existing?.topic ?? initialTopic ?? 'General');
  const [content, setContent] = useState(existing?.content ?? '');
  const [savedAt, setSavedAt] = useState<string | null>(existing?.updated_at ?? null);
  const [dirtyUi, setDirtyUi] = useState(false);
  const [keyPresent, setKeyPresent] = useState<boolean | null>(null);
  const [fixing, setFixing] = useState(false);
  const [refined, setRefined] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const idRef = useRef<string | null>(initialId ?? null);
  const latest = useRef({ title, topic, content });
  latest.current = { title, topic, content };
  const dirty = useRef(false);
  const saving = useRef(false);
  const dictation = useRef<DictationSession | null>(null);
  const dictationBase = useRef('');
  const speechAvailable = useRef(isSpeechAvailable()).current;

  const markDirty = () => {
    dirty.current = true;
    setDirtyUi(true);
  };

  /** Writes the draft to SQLite if anything changed and the body is non-empty. */
  const save = useCallback(async () => {
    if (!dirty.current || saving.current) return;
    const v = latest.current;
    if (!v.content.trim()) return;
    saving.current = true;
    dirty.current = false;
    try {
      const n = await saveNote(idRef.current, v);
      idRef.current = n.id;
      setSavedAt(n.updated_at);
      if (!dirty.current) setDirtyUi(false);
    } catch (e) {
      dirty.current = true;
      setToast(`Could not save: ${(e as Error).message}`);
    } finally {
      saving.current = false;
    }
  }, [saveNote]);

  // F4: auto-save the draft every 5 seconds while editing.
  useEffect(() => {
    const id = setInterval(() => void save(), NOTE_AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [save]);

  useEffect(() => {
    registerFlush(save);
  }, [registerFlush, save]);

  useEffect(() => {
    hasApiKey().then(setKeyPresent).catch(() => setKeyPresent(false));
    return () => dictation.current?.abort();
  }, [hasApiKey]);

  const onFixGrammar = async () => {
    if (!content.trim()) return;
    setFixing(true);
    try {
      setRefined(await refineText(content));
    } catch (e) {
      const kind = e instanceof AiError ? e.kind : 'other';
      setToast(
        kind === 'network'
          ? MESSAGES.grammarOffline
          : kind === 'invalid_key'
            ? MESSAGES.apiKeyInvalid
            : kind === 'missing_key'
              ? MESSAGES.apiKeyMissing
              : `AI request failed: ${(e as Error).message}`,
      );
    } finally {
      setFixing(false);
    }
  };

  const onAccept = async () => {
    if (refined === null) return;
    setContent(refined);
    latest.current = { ...latest.current, content: refined };
    setRefined(null);
    dirty.current = true;
    await save(); // replaces content and logs updated_at immediately
  };

  const toggleDictation = async () => {
    if (listening) {
      dictation.current?.stop();
      return;
    }
    if (!(await ensureMicPermission().catch(() => false))) {
      Alert.alert('Microphone access needed', MESSAGES.audioPermission);
      return;
    }
    dictationBase.current = latest.current.content.replace(/\s+$/, '');
    setListening(true);
    dictation.current = startDictation(
      {
        onTranscript: (t) => {
          const base = dictationBase.current;
          setContent(base ? `${base}${base.endsWith('\n') ? '' : ' '}${t}` : t);
          markDirty();
        },
        onError: (kind) => kind === 'no-speech' && setToast(MESSAGES.noSpeech),
        onEnd: () => {
          dictation.current = null;
          setListening(false);
        },
      },
      { continuous: true },
    );
  };

  const onDelete = () =>
    Alert.alert('Delete note', 'Delete this note? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          dirty.current = false;
          if (idRef.current) await removeNote(idRef.current);
          onDeleted();
        },
      },
    ]);

  const status = dirtyUi ? 'Editing… auto-saves every 5 s' : savedAt ? `Saved ${formatTime12(toHHmm(new Date(savedAt)))}` : 'New note';
  const topicChoices = [...new Set(['General', ...topics])];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="height">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          mode="flat"
          placeholder="Title"
          accessibilityLabel="Note title"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            markDirty();
          }}
          style={styles.titleInput}
          contentStyle={styles.titleText}
          maxLength={120}
        />
        <TextInput
          mode="outlined"
          label="Topic"
          accessibilityLabel="Note topic"
          value={topic}
          onChangeText={(t) => {
            setTopic(t);
            markDirty();
          }}
          maxLength={LIMITS.noteTopic}
          dense
          style={styles.topicInput}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {topicChoices.map((t) => (
            <FilterChip
              key={t}
              label={t}
              selected={t === topic.trim()}
              onPress={() => {
                setTopic(t);
                markDirty();
              }}
            />
          ))}
        </ScrollView>
        <TextInput
          mode="flat"
          placeholder="Write or dictate your note…"
          accessibilityLabel="Note text"
          value={content}
          onChangeText={(t) => {
            setContent(t);
            markDirty();
          }}
          multiline
          style={styles.body}
          textAlignVertical="top"
        />
      </ScrollView>

      <View style={styles.toolbar}>
        <Text style={styles.status} numberOfLines={1}>
          {listening ? 'Listening… tap the mic to stop' : status}
        </Text>
        {speechAvailable ? (
          <IconButton
            icon={({ size }) => (listening ? <MicOff color={c.priorityHigh} size={size} /> : <Mic color={c.textPrimary} size={size} />)}
            onPress={toggleDictation}
            style={styles.icon}
            accessibilityLabel={listening ? 'Stop dictation' : 'Dictate into note'}
          />
        ) : null}
        <IconButton
          icon={({ size }) => <Trash2 color={c.textMuted} size={size} />}
          onPress={onDelete}
          style={styles.icon}
          accessibilityLabel="Delete note"
        />
        <Button
          mode="contained"
          icon={({ color }) => <Sparkles color={color} size={16} />}
          onPress={onFixGrammar}
          loading={fixing}
          disabled={fixing || !content.trim() || keyPresent === false}
          style={styles.fixBtn}
          contentStyle={{ minHeight: MIN_TOUCH }}
        >
          Fix Grammar & Format
        </Button>
      </View>
      {keyPresent === false ? (
        <HelperText type="info" style={styles.keyHint}>
          {MESSAGES.apiKeyMissing}
        </HelperText>
      ) : null}

      <GrammarDiffModal original={content} refined={refined} onAccept={onAccept} onReject={() => setRefined(null)} />
      <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={4000} action={{ label: 'OK', onPress: () => setToast(null) }}>
        {toast ?? ''}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  content: { padding: ThemeTokens.spacing.md, gap: 8, paddingBottom: 24 },
  titleInput: { backgroundColor: 'transparent' },
  titleText: { fontSize: 20, fontWeight: '700' },
  topicInput: { backgroundColor: c.background },
  body: { backgroundColor: 'transparent', minHeight: 260, fontSize: 16, lineHeight: 24 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  status: { flex: 1, color: c.textMuted, fontSize: 12 },
  icon: { width: MIN_TOUCH, height: MIN_TOUCH, margin: 0 },
  fixBtn: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  keyHint: { backgroundColor: c.surface },
});
