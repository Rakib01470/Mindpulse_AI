import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB } from 'react-native-paper';
import { Mic } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { EmptyState } from '../components/common/EmptyState';

export function DashboardScreen() {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenHeader title="Dashboard" />
      <EmptyState message="Dashboard — coming in Phase 6. Tap the microphone to test voice capture." />
      <FAB icon={({ color, size }) => <Mic color={color} size={size} />} style={{ position: 'absolute', right: 16, bottom: 16 }} onPress={() => navigation.navigate('VoiceCapture')} accessibilityLabel="Capture task by voice" />
    </SafeAreaView>
  );
}
