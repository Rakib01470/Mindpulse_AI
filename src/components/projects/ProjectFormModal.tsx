import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Modal, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import type { Project, ProjectStatus } from '../../database/types';
import { DEFAULT_TARGET_HOURS } from '../../database/projectsDao';
import { ValidationError } from '../../database/types';
import { useProjects } from '../../context/ProjectsContext';
import { LIMITS } from '../../utils/constants';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

/** Create ("+ New Project") or edit a project. */
export function ProjectFormModal({ visible, onDismiss, project }: { visible: boolean; onDismiss: () => void; project?: Project | null }) {
  const { createProject, editProject } = useProjects();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState(String(DEFAULT_TARGET_HOURS));
  const [status, setStatus] = useState<ProjectStatus>('Active');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(project?.title ?? '');
    setDescription(project?.description ?? '');
    setTarget(String(project?.target_hours ?? DEFAULT_TARGET_HOURS));
    setStatus(project?.status ?? 'Active');
    setError(null);
  }, [visible, project]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const input = { title, description, target_hours: Number(target.replace(/,/g, '')), status };
      if (project) await editProject(project.id, input);
      else await createProject(input);
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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text variant="titleLarge" style={styles.title}>
            {project ? 'Edit Project' : 'New Project'}
          </Text>
          <TextInput mode="outlined" label="Title (e.g. 3D Asset Dev)" value={title} onChangeText={setTitle} maxLength={LIMITS.projectTitle} />
          <TextInput mode="outlined" label="Description" value={description} onChangeText={setDescription} multiline style={styles.gap} />
          <TextInput
            mode="outlined"
            label="Target hours"
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            style={styles.gap}
          />
          {project ? (
            <SegmentedButtons
              style={styles.gap}
              value={status}
              onValueChange={(v) => setStatus(v as ProjectStatus)}
              buttons={(['Active', 'On Hold', 'Completed'] as const).map((s) => ({ value: s, label: s, style: { minHeight: 48, justifyContent: 'center' } }))}
            />
          ) : null}
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
          <View style={styles.actions}>
            <Button onPress={onDismiss} style={styles.btn}>
              Cancel
            </Button>
            <Button mode="contained" onPress={save} loading={busy} disabled={busy} style={styles.btn}>
              {project ? 'Save' : 'Create Project'}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: c.surface, margin: 12, borderRadius: ThemeTokens.roundness },
  content: { padding: ThemeTokens.spacing.md },
  title: { color: c.textPrimary, marginBottom: 8 },
  gap: { marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btn: { minHeight: 48, justifyContent: 'center' },
});
