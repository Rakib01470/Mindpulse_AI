import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AlertCircle } from 'lucide-react-native';
import type { TaskWithCategory } from '../../database/types';
import { CategoryPill, PriorityBadge } from '../common/Badge';
import { formatDue } from '../../utils/formatting';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

/** Horizontally scrolling "Urgent Focus" card. */
export function TaskSummaryCard({ task, overdue, onPress }: { task: TaskWithCategory; overdue: boolean; onPress: () => void }) {
  const due = formatDue(task.due_date, task.due_time);
  return (
    <Pressable style={[styles.card, overdue && styles.overdue]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open task ${task.title}`}>
      <View style={styles.badges}>
        <PriorityBadge priority={task.priority} />
        {overdue ? (
          <View style={styles.overdueTag}>
            <AlertCircle color={c.priorityHigh} size={14} />
            <Text style={styles.overdueText}>Overdue</Text>
          </View>
        ) : null}
      </View>
      <Text variant="titleMedium" style={styles.title} numberOfLines={3}>
        {task.title}
      </Text>
      <View style={styles.footer}>
        <CategoryPill name={task.category_name} />
        {due ? <Text style={[styles.due, overdue && { color: c.priorityHigh }]}>{due}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    minHeight: 150,
    backgroundColor: c.surface,
    borderRadius: ThemeTokens.roundness,
    padding: 14,
    marginRight: 12,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: c.priorityHigh,
    justifyContent: 'space-between',
  },
  overdue: { backgroundColor: '#2A1E2B' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overdueTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  overdueText: { color: c.priorityHigh, fontSize: 12, fontWeight: '700' },
  title: { color: c.textPrimary },
  footer: { gap: 6 },
  due: { color: c.textMuted, fontSize: 12 },
});
