import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { Sparkles } from 'lucide-react-native';
import { wordDiff } from '../../utils/wordDiff';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

interface Props {
  original: string;
  refined: string | null;
  onAccept: () => void;
  onReject: () => void;
}

/** Original vs AI-refined text (stacked for phone width) with word-level highlights. */
export function GrammarDiffModal({ original, refined, onAccept, onReject }: Props) {
  const diff = useMemo(() => (refined === null ? null : wordDiff(original, refined)), [original, refined]);

  return (
    <Portal>
      <Modal visible={refined !== null} onDismiss={onReject} contentContainerStyle={styles.modal}>
        <View style={styles.header}>
          <Sparkles color={c.accent} size={20} />
          <Text variant="titleLarge" style={styles.title}>
            AI suggestions
          </Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text variant="labelLarge" style={styles.label}>
            Original
          </Text>
          <View style={[styles.box, styles.boxOriginal]}>
            <Text style={styles.text}>
              {diff
                ? diff
                    .filter((p) => p.type !== 'added')
                    .map((p, i) => (
                      <Text key={i} style={p.type === 'removed' ? styles.removed : undefined}>
                        {p.text}
                      </Text>
                    ))
                : original}
            </Text>
          </View>
          <Text variant="labelLarge" style={styles.label}>
            Refined
          </Text>
          <View style={[styles.box, styles.boxRefined]}>
            <Text style={styles.text}>
              {diff
                ? diff
                    .filter((p) => p.type !== 'removed')
                    .map((p, i) => (
                      <Text key={i} style={p.type === 'added' ? styles.added : undefined}>
                        {p.text}
                      </Text>
                    ))
                : refined}
            </Text>
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <Button mode="outlined" onPress={onReject} style={styles.btn}>
            Reject
          </Button>
          <Button mode="contained" onPress={onAccept} style={styles.btn}>
            Accept Changes
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: c.surface, margin: 12, borderRadius: ThemeTokens.roundness, maxHeight: '90%', padding: ThemeTokens.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: c.textPrimary },
  scroll: { flexGrow: 0 },
  content: { gap: 6, paddingBottom: 8 },
  label: { color: c.textMuted, marginTop: 6 },
  box: { borderRadius: 8, padding: 12, borderWidth: 1 },
  boxOriginal: { borderColor: c.border, backgroundColor: c.background },
  boxRefined: { borderColor: c.success, backgroundColor: c.background },
  text: { color: c.textPrimary, lineHeight: 22 },
  removed: { color: c.priorityHigh, textDecorationLine: 'line-through', backgroundColor: `${c.priorityHigh}22` },
  added: { color: c.success, backgroundColor: `${c.success}22` },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  btn: { minHeight: 48, justifyContent: 'center' },
});
