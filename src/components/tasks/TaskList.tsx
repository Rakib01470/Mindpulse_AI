import React, { useCallback } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import type { TaskWithCategory } from '../../database/types';
import { TaskItem } from './TaskItem';
import { EmptyState } from '../common/EmptyState';
import { ThemeTokens } from '../../utils/theme';

interface Props {
  tasks: TaskWithCategory[];
  onOpen: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onProgress: (id: string, percent: number) => void;
  emptyMessage: string;
  header?: React.ReactElement;
}

export function TaskList({ tasks, onOpen, onToggle, onProgress, emptyMessage, header }: Props) {
  const renderItem = useCallback(
    ({ item }: { item: TaskWithCategory }) => <TaskItem task={item} onPress={onOpen} onToggle={onToggle} onProgress={onProgress} />,
    [onOpen, onToggle, onProgress],
  );
  return (
    <FlatList
      data={tasks}
      keyExtractor={(t) => t.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState message={emptyMessage} />}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: ThemeTokens.spacing.md, paddingBottom: 160 },
});
