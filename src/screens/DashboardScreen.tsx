import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, Surface, Text } from 'react-native-paper';
import { Mic, Sparkles } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDatabase } from '../context/DatabaseContext';
import { useTasks } from '../context/TasksContext';
import { useProjects } from '../context/ProjectsContext';
import { useNotes } from '../context/NotesContext';
import { getDashboardData, type DashboardData } from '../database/dashboardDao';
import { TaskSummaryCard } from '../components/dashboard/TaskSummaryCard';
import { ProjectWidget } from '../components/dashboard/ProjectWidget';
import { QuickStats } from '../components/dashboard/QuickStats';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { MESSAGES } from '../utils/constants';
import { formatLongDate } from '../utils/formatting';
import { MIN_TOUCH, ThemeTokens } from '../utils/theme';

const c = ThemeTokens.colors;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function DashboardScreen() {
  const navigation = useNavigation();
  const { db } = useDatabase();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const { notes } = useNotes();
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const d = await getDashboardData(db);
    if (__DEV__) console.log(`Dashboard loaded in ${d.loadMs}ms`);
    setData(d);
  }, [db]);

  // Reload when the tab gains focus and whenever underlying data changes.
  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.error('Dashboard load failed', e));
    }, [load]),
  );
  useEffect(() => {
    load().catch(() => undefined);
  }, [load, tasks, projects, notes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().finally(() => setRefreshing(false));
  };

  const nothingToDo = !!data && data.urgentTasks.length === 0 && data.activeProjects.length === 0;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="labelLarge" style={styles.muted}>
            {formatLongDate(new Date())}
          </Text>
          <Text variant="headlineSmall" style={styles.title}>
            MindPulse
          </Text>
        </View>
        <IconButton
          mode="contained"
          icon={({ size }) => <Mic color="#002233" size={size} />}
          containerColor={c.accent}
          size={28}
          style={styles.mic}
          onPress={() => navigation.navigate('VoiceCapture')}
          accessibilityLabel="Capture task by voice"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}>
        {nothingToDo ? (
          <Surface style={styles.emptyCard} elevation={1}>
            <EmptyState icon={<Sparkles color={c.accent} size={36} />} message={MESSAGES.dashboardEmpty} />
          </Surface>
        ) : null}

        {data && data.urgentTasks.length > 0 ? (
          <Section title="Urgent Focus">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {data.urgentTasks.map((t) => (
                <TaskSummaryCard key={t.id} task={t} overdue={!!t.overdue} onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })} />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {data && data.activeProjects.length > 0 ? (
          <Section title="Project Progress">
            <Surface style={styles.card} elevation={1}>
              {data.activeProjects.map((p) => (
                <ProjectWidget key={p.id} project={p} onOpen={() => navigation.navigate('ProjectDetail', { projectId: p.id })} />
              ))}
            </Surface>
          </Section>
        ) : null}

        {data ? (
          <Section title="Quick Stats">
            <QuickStats completedToday={data.completedToday} secondsThisWeek={data.secondsThisWeek} pendingCount={data.pendingCount} dueToday={data.dueToday} />
          </Section>
        ) : null}

        {data && data.recentNotes.length > 0 ? (
          <Section title="Recent Notes">
            {data.recentNotes.map((n) => (
              <NoteCard key={n.id} note={n} onPress={(id) => navigation.navigate('NoteEditor', { noteId: id })} />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: ThemeTokens.spacing.md, paddingTop: 8, paddingBottom: 4 },
  title: { color: c.textPrimary, fontWeight: '800' },
  muted: { color: c.textMuted },
  mic: { width: 56, height: 56, minWidth: MIN_TOUCH, minHeight: MIN_TOUCH },
  content: { padding: ThemeTokens.spacing.md, gap: ThemeTokens.spacing.lg, paddingBottom: 120 },
  section: { gap: 10 },
  sectionTitle: { color: c.textPrimary, fontWeight: '700' },
  card: { backgroundColor: c.surface, borderRadius: ThemeTokens.roundness, paddingHorizontal: 14, paddingVertical: 4 },
  emptyCard: { backgroundColor: c.surface, borderRadius: ThemeTokens.roundness },
});
