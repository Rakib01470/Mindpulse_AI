import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput, Surface } from 'react-native-paper';
import { CheckCircle2, XCircle, KeyRound } from 'lucide-react-native';
import { useDatabase } from '../../context/DatabaseContext';
import { loadApiKey, saveApiKey, clearApiKey, maskApiKey } from '../../services/apiKeyStore';
import { AiError, detectProvider, providerLabel, testApiKey } from '../../services/aiService';
import { MESSAGES } from '../../utils/constants';
import { ThemeTokens } from '../../utils/theme';

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'valid' }
  | { kind: 'invalid' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

export function ApiKeySection() {
  const { db } = useDatabase();
  const [saved, setSaved] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApiKey(db).then(setSaved).catch(() => setSaved(null));
  }, [db]);

  const onSave = async () => {
    const trimmed = input.trim();
    if (!detectProvider(trimmed)) {
      setError('Paste an Anthropic key (starts with "sk-ant-") or a Gemini key (starts with "AIza").');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveApiKey(db, trimmed);
      setSaved(trimmed);
      setInput('');
      setTest({ kind: 'idle' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    const key = input.trim() || saved;
    if (!key) {
      setError(MESSAGES.apiKeyMissing);
      return;
    }
    setTest({ kind: 'testing' });
    try {
      setTest({ kind: (await testApiKey(key)) ? 'valid' : 'invalid' });
    } catch (e) {
      if (e instanceof AiError && e.kind === 'network') setTest({ kind: 'offline' });
      else if (e instanceof AiError && e.kind === 'rate_limited') setTest({ kind: 'error', message: MESSAGES.rateLimited });
      else setTest({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const typed = input.trim() ? detectProvider(input) : null;
  const activeProvider = typed ?? (saved ? detectProvider(saved) : null);

  const onClear = async () => {
    await clearApiKey(db);
    setSaved(null);
    setTest({ kind: 'idle' });
  };

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.titleRow}>
        <KeyRound color={ThemeTokens.colors.accent} size={20} />
        <Text variant="titleMedium" style={styles.title}>
          AI API Key
        </Text>
      </View>
      <Text variant="bodySmall" style={styles.muted}>
        {saved ? `Saved (encrypted on this device): ${maskApiKey(saved)}` : 'No key saved. AI parsing and grammar fixes are disabled.'}
      </Text>
      <TextInput
        mode="outlined"
        label={saved ? 'Replace key' : 'sk-ant-... or AIza...'}
        accessibilityLabel="AI API key"
        value={input}
        onChangeText={(t) => {
          setInput(t);
          setError(null);
        }}
        secureTextEntry={!reveal}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        right={<TextInput.Icon icon={reveal ? 'eye-off' : 'eye'} onPress={() => setReveal((r) => !r)} />}
      />
      {error ? <HelperText type="error">{error}</HelperText> : null}
      <View style={styles.buttons}>
        <Button mode="contained" onPress={onSave} disabled={!input.trim() || busy} loading={busy} style={styles.btn}>
          Save Key
        </Button>
        <Button mode="outlined" onPress={onTest} disabled={test.kind === 'testing' || (!input.trim() && !saved)} loading={test.kind === 'testing'} style={styles.btn}>
          Test API Key
        </Button>
      </View>
      {test.kind === 'valid' ? (
        <View style={styles.result}>
          <CheckCircle2 color={ThemeTokens.colors.success} size={18} />
          <Text style={{ color: ThemeTokens.colors.success }}>{MESSAGES.validKey}</Text>
        </View>
      ) : null}
      {test.kind === 'invalid' ? (
        <View style={styles.result}>
          <XCircle color={ThemeTokens.colors.priorityHigh} size={18} />
          <Text style={{ color: ThemeTokens.colors.priorityHigh }}>{MESSAGES.invalidKey}</Text>
        </View>
      ) : null}
      {test.kind === 'offline' ? <HelperText type="error">Network unavailable — could not reach the AI service.</HelperText> : null}
      {test.kind === 'error' ? <HelperText type="error">Could not verify the key: {test.message}</HelperText> : null}
      {saved ? (
        <Button mode="text" onPress={onClear} textColor={ThemeTokens.colors.priorityHigh} style={styles.clear}>
          Remove saved key
        </Button>
      ) : null}
      <Text variant="labelSmall" style={styles.muted}>
        {activeProvider ? `Using: ${providerLabel(activeProvider)}` : 'Anthropic (sk-ant-…) and Google Gemini (AIza…) keys are both supported.'}
      </Text>
      {activeProvider === 'gemini' ? (
        <Text variant="labelSmall" style={styles.warn}>
          Gemini free tier: Google may use what you send to improve its products. Avoid putting confidential work or customer details into AI fixes.
        </Text>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ThemeTokens.roundness, padding: ThemeTokens.spacing.md, gap: ThemeTokens.spacing.sm, backgroundColor: ThemeTokens.colors.surface },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: ThemeTokens.colors.textPrimary, fontWeight: '600' },
  muted: { color: ThemeTokens.colors.textMuted },
  warn: { color: ThemeTokens.colors.priorityMedium },
  input: { backgroundColor: ThemeTokens.colors.surface },
  buttons: { flexDirection: 'row', gap: ThemeTokens.spacing.sm, flexWrap: 'wrap' },
  btn: { minHeight: 48, justifyContent: 'center', flexGrow: 1 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clear: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' },
});
