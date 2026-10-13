import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { Plus, Timer } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useProjects } from '../context/ProjectsContext';
import type { Project, ProjectStatus } from '../database/types';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { FilterChip } from '../components/common/FilterChip';
import { EmptyState } from '../components/common/EmptyState';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { ManualTimeModal } from '../components/projects/ManualTimeModal';
import { formatHours } from '../utils/formatting';
import { PROJECT_STATUSES } from '../utils/constants';
import { ThemeTokens } from '../utils/theme';

export function ProjectsScreen() {
  const navigation = useNavigation();
  const { projects } = useProjects();
  const [status, setStatus] = useState<ProjectStatus | 'all'>('Active');
  const [creating, setCreating] = useState(false);
  const [logFor, setLogFor] = useState<Project | null>(null);

  const visible = useMemo(() => (status === 'all' ? projects : projects.filter((p) => p.status === status)), [projects, status]);
  const totalHours = projects.reduce((s, p) => s + p.tracked_seconds, 0) / 3600;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader
        title="Projects"
        subtitle={`${formatHours(totalHours)} hrs logged in total`}
        right={
          <Button mode="contained" icon={({ color }) => <Plus color={color} size={16} />} onPress={() => setCreating(true)} style={styles.newBtn}>
            New Project
          </Button>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        {PROJECT_STATUSES.map((s) => (
          <FilterChip key={s} label={s} selected={status === s} onPress={() => setStatus(s)} />
        ))}
        <FilterChip label="All" selected={status === 'all'} onPress={() => setStatus('all')} />
      </ScrollView>
      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProjectCard project={item} onOpen={(id) => navigation.navigate('ProjectDetail', { projectId: id })} onLogTime={setLogFor} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={<Timer color={ThemeTokens.colors.textMuted} size={40} />}
            message={projects.length === 0 ? 'No projects yet. Create one like "3D Asset Dev" with a target in hours.' : `No ${status} projects.`}
          />
        }
      />
      <ProjectFormModal visible={creating} onDismiss={() => setCreating(false)} />
      <ManualTimeModal project={logFor} onDismiss={() => setLogFor(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  newBtn: { minHeight: 48, justifyContent: 'center' },
  chipScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: ThemeTokens.spacing.md },
  list: { padding: ThemeTokens.spacing.md, paddingBottom: 120 },
});
