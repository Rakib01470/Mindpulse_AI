import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, Searchbar } from 'react-native-paper';
import { Mic, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTasks } from '../context/TasksContext';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { FilterChip } from '../components/common/FilterChip';
import { CategoryFilter } from '../components/tasks/CategoryFilter';
import { CategoryModal } from '../components/tasks/CategoryModal';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { TaskList } from '../components/tasks/TaskList';
import { confirmDeleteCategory } from '../components/tasks/confirmDeleteCategory';
import { DEFAULT_TASK_FILTER, filterTasks, type TaskFilter } from '../utils/taskFilters';
import { PRIORITIES, TASK_STATUSES } from '../utils/constants';
import { ThemeTokens } from '../utils/theme';

const c = ThemeTokens.colors;

export function TasksScreen() {
  const navigation = useNavigation();
  const { tasks, categories, setCompleted, setProgress, removeCategory } = useTasks();
  const [filter, setFilter] = useState<TaskFilter>(DEFAULT_TASK_FILTER);
  const [showCategory, setShowCategory] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const visible = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);
  const pending = tasks.filter((t) => t.status !== 'Completed').length;
  const patch = (p: Partial<TaskFilter>) => setFilter((f) => ({ ...f, ...p }));

  const onOpen = useCallback((id: string) => navigation.navigate('TaskDetail', { taskId: id }), [navigation]);
  const onToggle = useCallback((id: string, done: boolean) => void setCompleted(id, done), [setCompleted]);
  const onProgress = useCallback((id: string, p: number) => void setProgress(id, p), [setProgress]);

  const selectedCategory = categories.find((x) => x.id === filter.categoryId);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title="Tasks" subtitle={`${pending} open · ${tasks.length - pending} completed`} />
      <Searchbar
        placeholder="Search tasks"
        value={filter.query}
        onChangeText={(q) => patch({ query: q })}
        style={styles.search}
        inputStyle={{ minHeight: 48 }}
      />
      <CategoryFilter
        categories={categories}
        selected={filter.categoryId}
        onSelect={(id) => patch({ categoryId: id })}
        onAdd={() => setShowCategory(true)}
        onLongPressCategory={(cat) =>
          confirmDeleteCategory(cat, async () => {
            await removeCategory(cat.id);
            if (filter.categoryId === cat.id) patch({ categoryId: 'all' });
          })
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChip label="Any status" selected={filter.status === 'all'} onPress={() => patch({ status: 'all' })} />
        {TASK_STATUSES.map((s) => (
          <FilterChip key={s} label={s} selected={filter.status === s} onPress={() => patch({ status: s })} />
        ))}
        <View style={styles.divider} />
        <FilterChip label="Any priority" selected={filter.priority === 'all'} onPress={() => patch({ priority: 'all' })} />
        {PRIORITIES.map((p) => (
          <FilterChip key={p} label={p} selected={filter.priority === p} onPress={() => patch({ priority: p })} />
        ))}
      </ScrollView>

      <TaskList
        tasks={visible}
        onOpen={onOpen}
        onToggle={onToggle}
        onProgress={onProgress}
        emptyMessage={tasks.length === 0 ? 'No tasks yet. Tap the microphone to capture one.' : 'No tasks match these filters.'}
      />

      <FAB
        icon={({ color, size }) => <Plus color={color} size={size} />}
        size="small"
        style={styles.fabSmall}
        onPress={() => setShowForm(true)}
        accessibilityLabel="Add task manually"
      />
      <FAB
        icon={({ color, size }) => <Mic color={color} size={size} />}
        style={styles.fab}
        onPress={() => navigation.navigate('VoiceCapture')}
        accessibilityLabel="Capture task by voice"
      />
      <CategoryModal visible={showCategory} onDismiss={() => setShowCategory(false)} />
      <TaskFormModal
        visible={showForm}
        onDismiss={() => setShowForm(false)}
        initial={selectedCategory ? { category_name: selectedCategory.name } : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { marginHorizontal: ThemeTokens.spacing.md, marginBottom: 4, backgroundColor: c.surface },
  chipRow: { paddingHorizontal: ThemeTokens.spacing.md, alignItems: 'center', marginBottom: 6 },
  divider: { width: 1, height: 24, backgroundColor: c.border, marginHorizontal: 6 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  fabSmall: { position: 'absolute', right: 24, bottom: 92, minWidth: 48, minHeight: 48 },
});
