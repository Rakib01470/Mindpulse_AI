import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Surface, Text } from 'react-native-paper';
import { Sparkles } from 'lucide-react-native';
import type { TaskDraft } from '../../context/TasksContext';
import { TaskForm } from '../tasks/TaskForm';
import { MESSAGES } from '../../utils/constants';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

/** "Parsing task with AI..." indicator (F1). */
export function ParsingIndicator() {
  return (
    <Surface style={styles.card} elevation={2}>
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text variant="titleMedium" style={styles.text}>
          {MESSAGES.parsing}
        </Text>
      </View>
    </Surface>
  );
}

interface Props {
  draft: TaskDraft;
  onChange: (d: TaskDraft) => void;
  categories: string[];
  aiFilled: boolean;
  saving: boolean;
  titleError: string | null;
  onSave: () => void;
  onDiscard: () => void;
}

/** Pre-filled review card: user confirms with "Save Task" or drops it with "Discard". */
export function ParsingCard({ draft, onChange, categories, aiFilled, saving, titleError, onSave, onDiscard }: Props) {
  return (
    <Surface style={styles.card} elevation={2}>
      <View style={styles.header}>
        <Sparkles color={aiFilled ? c.accent : c.textMuted} size={18} />
        <Text variant="titleMedium" style={styles.text}>
          {aiFilled ? 'Review AI-parsed task' : 'Review task'}
        </Text>
      </View>
      <TaskForm value={draft} onChange={onChange} categories={categories} titleError={titleError} />
      <View style={styles.actions}>
        <Button mode="outlined" onPress={onDiscard} style={styles.btn} disabled={saving}>
          Discard
        </Button>
        <Button mode="contained" onPress={onSave} style={styles.btn} loading={saving} disabled={saving}>
          Save Task
        </Button>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ThemeTokens.roundness, padding: ThemeTokens.spacing.md, backgroundColor: c.surface },
  center: { alignItems: 'center', gap: 16, paddingVertical: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  text: { color: c.textPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  btn: { minHeight: 48, justifyContent: 'center', minWidth: 120 },
});
