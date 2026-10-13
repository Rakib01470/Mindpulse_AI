import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Text } from 'react-native-paper';
import { Pause, Play } from 'lucide-react-native';
import type { Project } from '../../database/types';
import { useTimer } from '../../context/ProjectsContext';
import { formatProjectProgress, formatStopwatch, projectProgressRatio } from '../../utils/formatting';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

/** Compact progress row with a quick "Resume Timer" action (F5). */
export function ProjectWidget({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const { timer, running, elapsed, requestStart, pause } = useTimer();
  const mine = timer?.projectId === project.id;
  const seconds = project.tracked_seconds + (mine ? elapsed : 0);
  const ratio = projectProgressRatio(seconds, project.target_hours);

  return (
    <View style={styles.row}>
      <Pressable style={styles.info} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open project ${project.title}`}>
        <Text style={styles.title} numberOfLines={1}>
          {project.title}
        </Text>
        <ProgressBar progress={Math.min(1, ratio)} color={ratio >= 1 ? c.success : c.accent} style={styles.bar} />
        <Text style={styles.hours}>{formatProjectProgress(seconds, project.target_hours)}</Text>
      </Pressable>
      <Button
        mode={mine && running ? 'contained-tonal' : 'outlined'}
        icon={({ color }) => (mine && running ? <Pause color={color} size={16} /> : <Play color={color} size={16} />)}
        onPress={() => (mine && running ? pause() : requestStart(project))}
        style={styles.btn}
        compact
      >
        {mine ? formatStopwatch(elapsed) : 'Resume Timer'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  info: { flex: 1, gap: 6, minHeight: 48, justifyContent: 'center' },
  title: { color: c.textPrimary, fontWeight: '600' },
  bar: { height: 6, borderRadius: 3, backgroundColor: c.surfaceVariant },
  hours: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  btn: { minHeight: 48, justifyContent: 'center' },
});
