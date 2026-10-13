import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import type { Category } from '../../database/types';
import { FilterChip } from '../common/FilterChip';
import { ThemeTokens } from '../../utils/theme';

interface Props {
  categories: Category[];
  selected: string | 'all';
  onSelect: (id: string | 'all') => void;
  onAdd: () => void;
  onLongPressCategory: (cat: Category) => void;
}

/** "All", "Office Work", "Personal Work", custom categories, then "+ Add Category" (F2). */
export function CategoryFilter({ categories, selected, onSelect, onAdd, onLongPressCategory }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <FilterChip label="All" selected={selected === 'all'} onPress={() => onSelect('all')} />
      {categories.map((cat) => (
        <FilterChip
          key={cat.id}
          label={cat.name}
          selected={selected === cat.id}
          onPress={() => onSelect(cat.id)}
          onLongPress={cat.is_system ? undefined : () => onLongPressCategory(cat)}
          accessibilityHint={cat.is_system ? undefined : 'Long-press to delete this category'}
        />
      ))}
      <FilterChip label="Add Category" icon={<Plus color={ThemeTokens.colors.accent} size={16} />} onPress={onAdd} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: ThemeTokens.spacing.md },
});
