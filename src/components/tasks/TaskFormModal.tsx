import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { emptyDraft, useTasks, type TaskDraft } from '../../context/TasksContext';
import { ValidationError } from '../../database/types';
import { TaskForm } from './TaskForm';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

/** Manual task entry (no voice). */
export function TaskFormModal({ visible, onDismiss, initial }: { visible: boolean; onDismiss: () => void; initial?: Partial<TaskDraft> }) {
  const { categories, addTask } = useTasks();
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(emptyDraft(initial));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await addTask(draft);
      onDismiss();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : `Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <KeyboardAvoidingView behavior="height">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text variant="titleLarge" style={styles.title}>
              New Task
            </Text>
            <TaskForm value={draft} onChange={setDraft} categories={categories.map((x) => x.name)} titleError={error} />
            <View style={styles.actions}>
              <Button onPress={onDismiss} style={styles.btn}>
                Cancel
              </Button>
              <Button mode="contained" onPress={save} loading={busy} disabled={busy} style={styles.btn}>
                Save Task
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: c.surface, margin: 12, borderRadius: ThemeTokens.roundness, maxHeight: '92%' },
  content: { padding: ThemeTokens.spacing.md },
  title: { color: c.textPrimary, marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  btn: { minHeight: 48, justifyContent: 'center' },
});
