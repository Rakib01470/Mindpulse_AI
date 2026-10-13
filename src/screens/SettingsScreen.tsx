import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { ApiKeySection } from '../components/settings/ApiKeySection';
import { ThemeTokens } from '../utils/theme';

export function SettingsScreen() {
  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ApiKeySection />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: ThemeTokens.spacing.md, gap: ThemeTokens.spacing.md, paddingBottom: 120 },
});
