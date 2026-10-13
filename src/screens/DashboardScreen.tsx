import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { EmptyState } from '../components/common/EmptyState';

export function DashboardScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenHeader title="Dashboard" />
      <EmptyState message="Dashboard — coming in a later phase." />
    </SafeAreaView>
  );
}
