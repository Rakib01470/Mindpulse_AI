import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Surface, Text } from 'react-native-paper';
import { Play, Plus } from 'lucide-react-native';
import type { Project } from '../../database/types';
import { useTimer } from '../../context/ProjectsContext';
import { formatProjectProgress, formatStopwatch, projectProgressRatio } from '../../utils/formatting';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

interface Props {
  project: Project;
  onOpen: (id: string) => void;
  onLogTime: (project: Project) => void;
  compact?: boolean;
}

export function ProjectCard({ project, onOpen, onLogTime, compact }: Props) {
  const { timer, running, elapsed, requestStart, pause } = useTimer();
  const mine = timer?.projectId === project.id;
  const liveSeconds = project.tracked_seconds + (mine ? elapsed : 0);
  const ratio = projectProgressRatio(liveSeconds, project.target_hours);
  const reached = ratio >= 1;

  return (
    <Surface style={styles.card} elevation={1}>
      <Pressable onPress={() => onOpen(project.id)} accessibilityRole="button" accessibilityLabel={`Open project ${project.title}`} style={styles.head}>
        <View style={styles.titleRow}>
          <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
            {project.title}
          </Text>
          {project.status !== 'Active' ? <Text style={styles.status}>{project.status}</Text> : null}
        </View>
        {!compact && project.description ? (
          <Text variant="bodySmall" style={styles.muted} numberOfLines={2}>
            {project.description}
          </Text>
        ) : null}
        <ProgressBar progress={Math.min(1, ratio)} color={reached ? c.success : c.accent} style={styles.bar} />
        <Text style={styles.hours}>{formatProjectProgress(liveSeconds, project.target_hours)}</Text>
      </Pressable>
      <View style={styles.actions}>
        {mine ? (
          <Button
            mode={running ? 'contained-tonal' : 'contained'}
            onPress={() => (running ? pause() : requestStart(project))}
            style={styles.btn}
            contentStyle={styles.btnContent}
          >
            {running ? `Pause · ${formatStopwatch(elapsed)}` : `Resume Timer · ${formatStopwatch(elapsed)}`}
          </Button>
        ) : (
          <Button
            mode="contained"
            icon={({ color }) => <Play color={color} size={16} />}
            onPress={() => requestStart(project)}
            style={styles.btn}
            contentStyle={styles.btnContent}
            disabled={project.status === 'Completed'}
          >
            {compact ? 'Resume Timer' : 'Start Session'}
          </Button>
        )}
        {!compact ? (
          <Button mode="outlined" icon={({ color }) => <Plus color={color} size={16} />} onPress={() => onLogTime(project)} style={styles.btnSecondary} contentStyle={styles.btnContent}>
            Log time
          </Button>
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ThemeTokens.roundness, backgroundColor: c.surface, padding: ThemeTokens.spacing.md, marginBottom: 12, gap: 10 },
  head: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: c.textPrimary, fontWeight: '700', flex: 1 },
  status: { color: c.priorityMedium, fontSize: 12, fontWeight: '600' },
  muted: { color: c.textMuted },
  bar: { height: 8, borderRadius: 4, backgroundColor: c.surfaceVariant, marginTop: 4 },
  hours: { color: c.textPrimary, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: 48, justifyContent: 'center' },
  btnSecondary: { minHeight: 48, justifyContent: 'center' },
  btnContent: { minHeight: 48 },
});
