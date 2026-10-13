import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Surface, Text } from 'react-native-paper';
import { Lock, Tags, Trash2 } from 'lucide-react-native';
import { useTasks } from '../../context/TasksContext';
import { CategoryModal } from '../tasks/CategoryModal';
import { confirmDeleteCategory } from '../tasks/confirmDeleteCategory';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

export function CategoriesSection() {
  const { categories, tasks, removeCategory } = useTasks();
  const [adding, setAdding] = useState(false);
  const countFor = (id: string) => tasks.filter((t) => t.category_id === id).length;

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.titleRow}>
        <Tags color={c.accent} size={20} />
        <Text variant="titleMedium" style={styles.title}>
          Task Categories
        </Text>
      </View>
      {categories.map((cat) => (
        <View key={cat.id} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {cat.name}
          </Text>
          <Text style={styles.muted}>{countFor(cat.id)} tasks</Text>
          {cat.is_system ? (
            <View style={styles.iconSlot}>
              <Lock color={c.textMuted} size={16} />
            </View>
          ) : (
            <IconButton
              icon={({ size }) => <Trash2 color={c.priorityHigh} size={size} />}
              size={22}
              style={styles.iconBtn}
              onPress={() => confirmDeleteCategory(cat, () => removeCategory(cat.id))}
              accessibilityLabel={`Delete category ${cat.name}`}
            />
          )}
        </View>
      ))}
      <Button mode="outlined" onPress={() => setAdding(true)} style={styles.btn}>
        + Add Category
      </Button>
      <CategoryModal visible={adding} onDismiss={() => setAdding(false)} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ThemeTokens.roundness, padding: ThemeTokens.spacing.md, gap: 4, backgroundColor: c.surface },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { color: c.textPrimary, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8 },
  name: { color: c.textPrimary, flex: 1 },
  muted: { color: c.textMuted, fontSize: 12 },
  iconSlot: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 48, height: 48, margin: 0 },
  btn: { minHeight: 48, justifyContent: 'center', marginTop: 8 },
});
