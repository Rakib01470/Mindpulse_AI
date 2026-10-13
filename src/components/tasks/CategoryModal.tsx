import React, { useState } from 'react';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';
import { useTasks } from '../../context/TasksContext';
import { LIMITS } from '../../utils/constants';
import { ThemeTokens } from '../../utils/theme';

/** Custom category creation; duplicate names (case-insensitive) show "Category already exists". */
export function CategoryModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { addCategory } = useTasks();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setName('');
    setError(null);
    onDismiss();
  };

  const save = async () => {
    setBusy(true);
    try {
      await addCategory(name);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={{ backgroundColor: ThemeTokens.colors.surface }}>
        <Dialog.Title>New Category</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            label="Name (e.g. Academic Work)"
            accessibilityLabel="Category name"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
            maxLength={LIMITS.categoryName}
            autoFocus
            error={!!error}
            onSubmitEditing={save}
          />
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={close} style={{ minHeight: 48, justifyContent: 'center' }}>
            Cancel
          </Button>
          <Button onPress={save} disabled={!name.trim() || busy} loading={busy} style={{ minHeight: 48, justifyContent: 'center' }}>
            Add
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
