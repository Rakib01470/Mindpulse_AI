import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { EmptyState } from '../components/common/EmptyState';

export function ProjectsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenHeader title="Projects" />
      <EmptyState message="Projects — coming in a later phase." />
    </SafeAreaView>
  );
}
