import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { EmptyState } from '../components/common/EmptyState';

export function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenHeader title="Settings" />
      <EmptyState message="Settings — coming in a later phase." />
    </SafeAreaView>
  );
}
