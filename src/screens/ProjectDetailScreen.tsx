import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Project, TimeLog } from '../database/types';
import { useProjects } from '../context/ProjectsContext';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { ManualTimeModal } from '../components/projects/ManualTimeModal';
import { SessionLogList } from '../components/projects/SessionLogList';
import { EmptyState } from '../components/common/EmptyState';
import { formatDurationShort } from '../utils/formatting';
import { ThemeTokens } from '../utils/theme';

const c = ThemeTokens.colors;

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;

export function ProjectDetailScreen({ route, navigation }: Props) {
  const { projects, getLogs, removeLog, removeProject, logsVersion } = useProjects();
  const project = projects.find((p) => p.id === route.params.projectId);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [editing, setEditing] = useState(false);
  const [logFor, setLogFor] = useState<Project | null>(null);

  const load = useCallback(() => {
    getLogs(route.params.projectId).then(setLogs).catch(() => setLogs([]));
  }, [getLogs, route.params.projectId]);

  useEffect(load, [load, logsVersion]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: project?.title ?? 'Project' });
  }, [navigation, project?.title]);

  if (!project) return <EmptyState message="This project no longer exists." />;

  const remove = () =>
    Alert.alert('Delete project', `Delete "${project.title}" and all ${logs.length} logged sessions? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeProject(project.id);
          navigation.goBack();
        },
      },
    ]);

  const avg = logs.length ? logs.reduce((s, l) => s + l.duration_seconds, 0) / logs.length : 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <ProjectCard project={project} onOpen={() => undefined} onLogTime={setLogFor} />
      <View style={styles.row}>
        <Button mode="outlined" onPress={() => setEditing(true)} style={styles.btn}>
          Edit
        </Button>
        <Button mode="outlined" textColor={c.priorityHigh} onPress={remove} style={styles.btn}>
          Delete
        </Button>
      </View>
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" style={styles.title}>
          Session log
        </Text>
        <Text variant="bodySmall" style={styles.muted}>
          {logs.length} sessions{logs.length ? ` · average ${formatDurationShort(avg)}` : ''} · long-press a session to delete it
        </Text>
        <SessionLogList logs={logs} onDelete={(id) => void removeLog(id)} />
      </Surface>
      <ProjectFormModal visible={editing} onDismiss={() => setEditing(false)} project={project} />
      <ManualTimeModal project={logFor} onDismiss={() => setLogFor(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  content: { padding: ThemeTokens.spacing.md, paddingBottom: 48, gap: 4 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btn: { flex: 1, minHeight: 48, justifyContent: 'center' },
  card: { borderRadius: ThemeTokens.roundness, backgroundColor: c.surface, padding: ThemeTokens.spacing.md, gap: 4 },
  title: { color: c.textPrimary, fontWeight: '700' },
  muted: { color: c.textMuted, marginBottom: 4 },
});
