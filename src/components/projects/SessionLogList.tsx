import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { TimeLog } from '../../database/types';
import { formatDateTime, formatDurationShort, formatTime12, toHHmm } from '../../utils/formatting';
import { EmptyState } from '../common/EmptyState';
import { MIN_TOUCH, ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

export function SessionLogList({ logs, onDelete }: { logs: TimeLog[]; onDelete: (id: string) => void }) {
  if (logs.length === 0) return <EmptyState message="No sessions logged yet. Tap Start Session to begin." />;
  return (
    <View>
      {logs.map((log) => (
        <Pressable
          key={log.id}
          style={styles.row}
          onLongPress={() =>
            Alert.alert('Delete session', `Remove this ${formatDurationShort(log.duration_seconds)} session? The time is subtracted from the project.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete(log.id) },
            ])
          }
          accessibilityHint="Long-press to delete this session"
        >
          <View style={styles.main}>
            <Text style={styles.when}>
              {formatDateTime(log.start_time)} – {formatTime12(toHHmm(new Date(log.end_time)))}
            </Text>
            {log.notes ? (
              <Text style={styles.notes} numberOfLines={3}>
                {log.notes}
              </Text>
            ) : null}
          </View>
          <Text style={styles.duration}>{formatDurationShort(log.duration_seconds)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    gap: 12,
  },
  main: { flex: 1, gap: 2 },
  when: { color: c.textPrimary },
  notes: { color: c.textMuted, fontSize: 13 },
  duration: { color: c.accent, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
