import React, { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Checkbox, Surface, Text } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { CalendarClock } from 'lucide-react-native';
import type { TaskWithCategory } from '../../database/types';
import { CategoryPill, PriorityBadge } from '../common/Badge';
import { formatDue, toHHmm, toIsoDate, truncate } from '../../utils/formatting';
import { LIMITS } from '../../utils/constants';
import { MIN_TOUCH, ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

export const isOverdue = (t: Pick<TaskWithCategory, 'status' | 'due_date' | 'due_time'>, now = new Date()): boolean => {
  if (t.status === 'Completed' || !t.due_date) return false;
  const today = toIsoDate(now);
  if (t.due_date < today) return true;
  return t.due_date === today && !!t.due_time && t.due_time < toHHmm(now);
};

interface Props {
  task: TaskWithCategory;
  onPress: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onProgress: (id: string, percent: number) => void;
}

function TaskItemBase({ task, onPress, onToggle, onProgress }: Props) {
  const done = task.status === 'Completed';
  const [progress, setProgress] = useState(task.progress_percent);
  useEffect(() => setProgress(task.progress_percent), [task.progress_percent]);
  const overdue = isOverdue(task);
  const due = formatDue(task.due_date, task.due_time);

  return (
    <Surface style={[styles.card, done && styles.cardDone]} elevation={1}>
      <View style={styles.row}>
        <View style={styles.checkWrap}>
          <Checkbox.Android
            status={done ? 'checked' : 'unchecked'}
            onPress={() => onToggle(task.id, !done)}
            color={c.success}
            uncheckedColor={c.textMuted}
            accessibilityLabel={done ? 'Mark as not completed' : 'Mark as completed'}
          />
        </View>
        <Pressable style={styles.body} onPress={() => onPress(task.id)} accessibilityRole="button" accessibilityLabel={`Open task ${task.title}`}>
          <Text variant="titleMedium" style={[styles.title, done && styles.strike]} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={styles.meta}>
            <CategoryPill name={task.category_name} />
            <PriorityBadge priority={task.priority} />
            {due ? (
              <View style={styles.due}>
                <CalendarClock color={overdue ? c.priorityHigh : c.textMuted} size={14} />
                <Text style={[styles.dueText, overdue && { color: c.priorityHigh }]}>{overdue ? `Overdue · ${due}` : due}</Text>
              </View>
            ) : null}
          </View>
          {task.summary ? (
            <Text variant="bodySmall" style={styles.summary}>
              {truncate(task.summary, LIMITS.listSummaryChars)}
            </Text>
          ) : null}
        </Pressable>
      </View>
      <View style={styles.progressRow}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={5}
          value={task.progress_percent}
          onValueChange={(v) => setProgress(Math.round(v))}
          onSlidingComplete={(v) => onProgress(task.id, Math.round(v))}
          minimumTrackTintColor={done ? c.success : c.accent}
          maximumTrackTintColor={c.border}
          thumbTintColor={done ? c.success : c.accent}
          accessibilityLabel="Task progress"
        />
        <Text style={styles.pct}>{progress}%</Text>
      </View>
    </Surface>
  );
}

export const TaskItem = memo(TaskItemBase);

const styles = StyleSheet.create({
  card: { borderRadius: ThemeTokens.roundness, backgroundColor: c.surface, paddingVertical: 8, paddingRight: 12, marginBottom: 10 },
  cardDone: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  checkWrap: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingTop: 10, gap: 6, minHeight: MIN_TOUCH },
  title: { color: c.textPrimary },
  strike: { textDecorationLine: 'line-through', color: c.textMuted },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueText: { color: c.textMuted, fontSize: 12 },
  summary: { color: c.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 40 },
  slider: { flex: 1, height: MIN_TOUCH },
  pct: { color: c.textMuted, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
