import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { emptyDraft, useTasks, type TaskDraft } from '../context/TasksContext';
import { ValidationError } from '../database/types';
import { TaskForm } from '../components/tasks/TaskForm';
import { EmptyState } from '../components/common/EmptyState';
import { formatDateTime } from '../utils/formatting';
import { ThemeTokens } from '../utils/theme';

const c = ThemeTokens.colors;

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

/** Task detail sheet: full text (no truncation), edit everything, delete. */
export function TaskDetailScreen({ route, navigation }: Props) {
  const { tasks, categories, saveTask, removeTask } = useTasks();
  const task = tasks.find((t) => t.id === route.params.taskId);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (task && !draft) {
      setDraft(
        emptyDraft({
          title: task.title,
          category_name: task.category_name,
          priority: task.priority,
          due_date: task.due_date,
          due_time: task.due_time,
          summary: task.summary,
          details: task.details,
          progress_percent: task.progress_percent,
        }),
      );
    }
  }, [task, draft]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: task?.status === 'Completed' ? 'Task · Completed' : 'Task' });
  }, [navigation, task?.status]);

  if (!task || !draft) return <EmptyState message="This task no longer exists." />;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveTask(task.id, draft);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : `Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete task', `Delete "${task.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeTask(task.id);
          navigation.goBack();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="height">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TaskForm value={draft} onChange={setDraft} categories={categories.map((x) => x.name)} showProgress titleError={error} />
        <Text variant="bodySmall" style={styles.meta}>
          Status: {task.status} · Created {formatDateTime(task.created_at)} · Updated {formatDateTime(task.updated_at)}
        </Text>
        <View style={styles.actions}>
          <Button mode="outlined" textColor={c.priorityHigh} onPress={remove} style={styles.btn}>
            Delete
          </Button>
          <Button mode="contained" onPress={save} loading={busy} disabled={busy} style={styles.btn}>
            Save Changes
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  content: { padding: ThemeTokens.spacing.md, paddingBottom: 48 },
  meta: { color: c.textMuted, marginTop: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 20 },
  btn: { minHeight: 48, justifyContent: 'center', flex: 1 },
});
