import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { Priority } from '../../database/types';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

/** F2: Red for High, Amber for Medium, Grey for Low (DECISIONS.md D-10). */
export const priorityColor = (p: Priority): string =>
  p === 'High' ? c.priorityHigh : p === 'Medium' ? c.priorityMedium : c.textMuted;

export function PriorityBadge({ priority }: { priority: Priority }) {
  const color = priorityColor(priority);
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}22` }]}>
      <Text style={[styles.text, { color }]}>{priority}</Text>
    </View>
  );
}

export function CategoryPill({ name }: { name: string }) {
  return (
    <View style={[styles.badge, styles.pill]}>
      <Text style={[styles.text, { color: c.textPrimary }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  pill: { borderColor: c.border, backgroundColor: c.surfaceVariant, maxWidth: 160 },
  text: { fontSize: 12, fontWeight: '600' },
});
