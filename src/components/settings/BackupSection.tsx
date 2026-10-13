import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import { DatabaseBackup, Download, Upload } from 'lucide-react-native';
import { useDatabase } from '../../context/DatabaseContext';
import { BackupValidationError, exportBackupToShare, importBackup, pickBackupFile } from '../../services/backupService';
import { MESSAGES } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatting';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

/** F6: JSON export via the Android share sheet, import via the file picker with Overwrite / Cancel. */
export function BackupSection() {
  const { db, reloadAll } = useDatabase();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const onExport = async () => {
    setBusy('export');
    try {
      const uri = await exportBackupToShare(db);
      setLast(`Exported ${uri.split('/').pop()}`);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    setBusy('import');
    try {
      const data = await pickBackupFile();
      if (!data) return;
      const summary =
        `${data.tasks.length} tasks, ${data.projects.length} projects, ${data.time_logs.length} sessions, ` +
        `${data.notes.length} notes, ${data.categories.length} categories` +
        (data.exported_at ? `\nExported ${formatDateTime(data.exported_at)}` : '');
      Alert.alert('Restore backup?', `This replaces ALL current tasks, projects, sessions and notes with:\n\n${summary}`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Overwrite',
          style: 'destructive',
          onPress: async () => {
            try {
              await importBackup(db, data);
              reloadAll();
              setLast('Backup restored');
              Alert.alert('Restore complete', 'Your data has been restored.');
            } catch (e) {
              console.error('Import failed', e);
              Alert.alert('Import failed', MESSAGES.importInvalid);
            }
          },
        },
      ]);
    } catch (e) {
      if (e instanceof BackupValidationError) console.warn(e.detail);
      Alert.alert('Import failed', MESSAGES.importInvalid);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.titleRow}>
        <DatabaseBackup color={c.accent} size={20} />
        <Text variant="titleMedium" style={styles.title}>
          Backup & Restore
        </Text>
      </View>
      <Text variant="bodySmall" style={styles.muted}>
        All data stays on this phone. Export a JSON backup to Drive, Files or WhatsApp; import it to restore. Your API key is never included.
      </Text>
      <View style={styles.row}>
        <Button mode="contained" icon={({ color }) => <Upload color={color} size={16} />} onPress={onExport} loading={busy === 'export'} disabled={!!busy} style={styles.btn}>
          Export Data
        </Button>
        <Button mode="outlined" icon={({ color }) => <Download color={color} size={16} />} onPress={onImport} loading={busy === 'import'} disabled={!!busy} style={styles.btn}>
          Import Data
        </Button>
      </View>
      {last ? <Text style={styles.muted}>{last}</Text> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ThemeTokens.roundness, padding: ThemeTokens.spacing.md, gap: ThemeTokens.spacing.sm, backgroundColor: c.surface },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: c.textPrimary, fontWeight: '600' },
  muted: { color: c.textMuted },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { flexGrow: 1, minHeight: 48, justifyContent: 'center' },
});
