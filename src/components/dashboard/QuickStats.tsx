import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { formatHours, formatSouthAsianNumber } from '../../utils/formatting';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** "Quick Stats" (F5): completed today, hours this week (Sunday start), plus open/due-today counts. */
export function QuickStats({ completedToday, secondsThisWeek, pendingCount, dueToday }: { completedToday: number; secondsThisWeek: number; pendingCount: number; dueToday: number }) {
  return (
    <View style={styles.grid}>
      <Stat value={formatSouthAsianNumber(completedToday)} label="Completed today" />
      <Stat value={formatHours(secondsThisWeek / 3600)} label="Hours this week" />
      <Stat value={formatSouthAsianNumber(dueToday)} label="Due today" />
      <Stat value={formatSouthAsianNumber(pendingCount)} label="Open tasks" />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderRadius: ThemeTokens.roundness, padding: 14, gap: 2 },
  value: { color: c.textPrimary, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { color: c.textMuted, fontSize: 12 },
});
