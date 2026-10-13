import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB, List, Searchbar } from 'react-native-paper';
import { NotebookPen, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotes } from '../context/NotesContext';
import { filterNotes, groupByTopic } from '../database/notesDao';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { EmptyState } from '../components/common/EmptyState';
import { NoteCard } from '../components/notes/NoteCard';
import { ThemeTokens } from '../utils/theme';

const c = ThemeTokens.colors;

export function NotesScreen() {
  const navigation = useNavigation();
  const { notes } = useNotes();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => groupByTopic(filterNotes(notes, query)), [notes, query]);
  const open = (id: string) => navigation.navigate('NoteEditor', { noteId: id });

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title="Notes" subtitle={`${notes.length} notes · ${new Set(notes.map((n) => n.topic)).size} topics`} />
      <Searchbar placeholder="Filter by topic, title or text" value={query} onChangeText={setQuery} style={styles.search} inputStyle={{ minHeight: 48 }} />
      <ScrollView contentContainerStyle={styles.list}>
        {groups.length === 0 ? (
          <EmptyState
            icon={<NotebookPen color={c.textMuted} size={40} />}
            message={notes.length === 0 ? 'No notes yet. Tap + to write or dictate one.' : 'No notes match your search.'}
          />
        ) : (
          groups.map((g) => (
            <List.Accordion
              key={g.topic}
              title={`${g.topic} (${g.notes.length})`}
              expanded={!!query || !collapsed[g.topic]}
              onPress={() => setCollapsed((s) => ({ ...s, [g.topic]: !s[g.topic] }))}
              style={styles.accordion}
              titleStyle={styles.accordionTitle}
            >
              {g.notes.map((n) => (
                <NoteCard key={n.id} note={n} onPress={open} />
              ))}
            </List.Accordion>
          ))
        )}
      </ScrollView>
      <FAB
        icon={({ color, size }) => <Plus color={color} size={size} />}
        style={styles.fab}
        onPress={() => navigation.navigate('NoteEditor', {})}
        accessibilityLabel="New note"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { marginHorizontal: ThemeTokens.spacing.md, marginBottom: 4, backgroundColor: c.surface },
  list: { paddingHorizontal: ThemeTokens.spacing.md, paddingBottom: 160 },
  accordion: { backgroundColor: c.background, paddingHorizontal: 0, minHeight: 48 },
  accordionTitle: { color: c.textPrimary, fontWeight: '700' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
