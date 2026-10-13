import React, { useEffect, useState } from 'react';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';
import type { Project } from '../../database/types';
import { useProjects } from '../../context/ProjectsContext';
import { ThemeTokens } from '../../utils/theme';

const btn = { minHeight: 48, justifyContent: 'center' as const };

/** Manual entry of past hours (F3) — input must be > 0. */
export function ManualTimeModal({ project, onDismiss }: { project: Project | null; onDismiss: () => void }) {
  const { addManualTime } = useProjects();
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHours('');
    setNotes('');
    setError(null);
  }, [project]);

  const save = async () => {
    if (!project) return;
    const value = Number(hours.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a number of hours greater than 0.');
      return;
    }
    setBusy(true);
    try {
      await addManualTime(project.id, value, notes);
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={!!project} onDismiss={onDismiss} style={{ backgroundColor: ThemeTokens.colors.surface }}>
        <Dialog.Title>Log past time</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            label={`Hours on ${project?.title ?? ''} (e.g. 1.5)`}
            value={hours}
            onChangeText={(t) => {
              setHours(t);
              setError(null);
            }}
            keyboardType="decimal-pad"
            accessibilityLabel="Hours to log"
            autoFocus
            error={!!error}
          />
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
          <TextInput mode="outlined" label="Notes (optional)" value={notes} onChangeText={setNotes} />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} style={btn}>
            Cancel
          </Button>
          <Button mode="contained" onPress={save} loading={busy} disabled={busy} style={btn}>
            Add Time
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
