import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { Note } from '../../database/types';
import { formatDateTime, truncate } from '../../utils/formatting';
import { MIN_TOUCH, ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

export function NoteCard({ note, onPress }: { note: Note; onPress: (id: string) => void }) {
  return (
    <Pressable style={styles.card} onPress={() => onPress(note.id)} accessibilityRole="button" accessibilityLabel={`Open note ${note.title}`}>
      <Text variant="titleSmall" style={styles.title} numberOfLines={1}>
        {note.title}
      </Text>
      <Text variant="bodySmall" style={styles.preview} numberOfLines={2}>
        {truncate(note.content.replace(/\s+/g, ' '), 140)}
      </Text>
      <Text style={styles.date}>{formatDateTime(note.updated_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TOUCH,
    backgroundColor: c.surface,
    borderRadius: ThemeTokens.roundness,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  title: { color: c.textPrimary, fontWeight: '600' },
  preview: { color: c.textMuted },
  date: { color: c.textMuted, fontSize: 11 },
});
