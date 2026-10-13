import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { Pause, Play, Square } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTimer } from '../../context/ProjectsContext';
import { formatStopwatch } from '../../utils/formatting';
import { MIN_TOUCH, ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

/** Sticky stopwatch shown above the tab bar on every tab while a session exists (F3). */
export function TimerWidget() {
  const { timer, running, elapsed, pause, resume, beginStop } = useTimer();
  const navigation = useNavigation();
  if (!timer) return null;

  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: running ? c.success : c.priorityMedium }]} />
      <Pressable
        style={styles.info}
        onPress={() => navigation.navigate('ProjectDetail', { projectId: timer.projectId })}
        accessibilityRole="button"
        accessibilityLabel={`Open project ${timer.projectTitle}`}
      >
        <Text style={styles.title} numberOfLines={1}>
          {timer.projectTitle}
        </Text>
        <Text style={styles.status}>{running ? 'Recording session' : 'Paused'}</Text>
      </Pressable>
      <Text style={styles.clock}>{formatStopwatch(elapsed)}</Text>
      <IconButton
        icon={({ size }) => (running ? <Pause color={c.textPrimary} size={size} /> : <Play color={c.textPrimary} size={size} />)}
        onPress={running ? pause : resume}
        style={styles.btn}
        accessibilityLabel={running ? 'Pause timer' : 'Resume timer'}
      />
      <IconButton
        icon={({ size }) => <Square color={c.priorityHigh} size={size} />}
        onPress={beginStop}
        style={styles.btn}
        accessibilityLabel="Stop Timer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: c.accent,
    paddingLeft: 14,
    minHeight: 60,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  info: { flex: 1, minHeight: MIN_TOUCH, justifyContent: 'center' },
  title: { color: c.textPrimary, fontWeight: '700' },
  status: { color: c.textMuted, fontSize: 12 },
  clock: { color: c.textPrimary, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'], marginHorizontal: 6 },
  btn: { width: MIN_TOUCH, height: MIN_TOUCH, margin: 0 },
});
