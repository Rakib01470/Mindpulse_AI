import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, SegmentedButtons, Surface, Text } from 'react-native-paper';
import { Languages } from 'lucide-react-native';
import { useDatabase } from '../../context/DatabaseContext';
import { loadVoiceLanguage, saveVoiceLanguage } from '../../services/voiceLanguageStore';
import { DEFAULT_VOICE_LANGUAGE, VOICE_LANGUAGES, type VoiceLanguage } from '../../utils/constants';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

export function VoiceLanguageSection() {
  const { db } = useDatabase();
  const [lang, setLang] = useState<VoiceLanguage>(DEFAULT_VOICE_LANGUAGE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVoiceLanguage(db).then(setLang).catch(() => undefined);
  }, [db]);

  const onChange = async (v: string) => {
    const next = v as VoiceLanguage;
    const prev = lang;
    setLang(next);
    setError(null);
    try {
      await saveVoiceLanguage(db, next);
    } catch (e) {
      setLang(prev);
      setError(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.titleRow}>
        <Languages color={c.accent} size={20} />
        <Text variant="titleMedium" style={styles.title}>
          Voice language
        </Text>
      </View>
      <SegmentedButtons
        value={lang}
        onValueChange={onChange}
        buttons={VOICE_LANGUAGES.map((l) => ({
          value: l.tag,
          label: l.label,
          accessibilityLabel: `Voice language ${l.label}`,
          style: { minHeight: 48, justifyContent: 'center' },
        }))}
      />
      <Text style={styles.muted}>
        Language you speak when dictating tasks. Bengali needs an internet connection unless the phone has Google's Bengali offline speech pack.
      </Text>
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ThemeTokens.roundness, padding: ThemeTokens.spacing.md, gap: 8, backgroundColor: c.surface },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { color: c.textPrimary, fontWeight: '600' },
  muted: { color: c.textMuted, fontSize: 12 },
});
