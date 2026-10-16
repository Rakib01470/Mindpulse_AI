import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { ApiKeySection } from '../components/settings/ApiKeySection';
import { CategoriesSection } from '../components/settings/CategoriesSection';
import { BackupSection } from '../components/settings/BackupSection';
import { VoiceLanguageSection } from '../components/settings/VoiceLanguageSection';
import { Text } from 'react-native-paper';
import Constants from 'expo-constants';
import { ThemeTokens } from '../utils/theme';

export function SettingsScreen() {
  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ApiKeySection />
        <VoiceLanguageSection />
        <CategoriesSection />
        <BackupSection />
        <Text variant="labelSmall" style={styles.version}>
          MindPulse AI v{Constants.expoConfig?.version ?? '1.0.0'} · local-first, no account
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  version: { color: ThemeTokens.colors.textMuted, textAlign: 'center' },
  content: { padding: ThemeTokens.spacing.md, gap: ThemeTokens.spacing.md, paddingBottom: 120 },
});
