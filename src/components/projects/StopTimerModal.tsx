import React, { useEffect, useState } from 'react';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { useTimer } from '../../context/ProjectsContext';
import { formatStopwatch } from '../../utils/formatting';
import { ThemeTokens } from '../../utils/theme';

const btn = { minHeight: 48, justifyContent: 'center' as const };

/** Shown after "Stop Timer": optional session notes, then the session is written to time_logs. */
export function StopTimerModal() {
  const { timer, stopping, elapsed, cancelStop, confirmStop, discard } = useTimer();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stopping) setNotes('');
  }, [stopping]);

  if (!timer) return null;

  const save = async () => {
    setBusy(true);
    try {
      await confirmStop(notes);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={stopping} onDismiss={cancelStop} style={{ backgroundColor: ThemeTokens.colors.surface }}>
        <Dialog.Title>Stop session</Dialog.Title>
        <Dialog.Content>
          <Text style={{ color: ThemeTokens.colors.textMuted, marginBottom: 8 }}>
            {timer.projectTitle} · {formatStopwatch(elapsed)}
          </Text>
          {elapsed < 1 ? (
            <Text style={{ color: ThemeTokens.colors.priorityMedium }}>Session is under 1 second and will not be logged.</Text>
          ) : (
            <TextInput mode="outlined" label="Session notes (optional)" accessibilityLabel="Session notes" value={notes} onChangeText={setNotes} multiline />
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={discard} textColor={ThemeTokens.colors.priorityHigh} style={btn}>
            Discard
          </Button>
          <Button onPress={cancelStop} style={btn}>
            Resume
          </Button>
          <Button mode="contained" onPress={save} loading={busy} disabled={busy} style={btn}>
            Save Session
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
