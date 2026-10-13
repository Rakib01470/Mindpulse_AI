import { Alert } from 'react-native';
import type { Category } from '../../database/types';
import { MESSAGES } from '../../utils/constants';

/** F2 prompt: "Delete category '[Name]'? Associated tasks will be moved to 'Personal Work'." */
export function confirmDeleteCategory(cat: Category, onConfirm: () => Promise<void>) {
  Alert.alert('Delete category', MESSAGES.deleteCategory(cat.name), [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        onConfirm().catch((e) => Alert.alert('Could not delete', e instanceof Error ? e.message : String(e)));
      },
    },
  ]);
}
