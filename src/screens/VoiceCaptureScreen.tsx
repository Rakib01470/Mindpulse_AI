import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { VoiceOverlay } from '../components/voice/VoiceOverlay';

export function VoiceCaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <VoiceOverlay
      onClose={() => navigation.goBack()}
      onOpenTask={(taskId) => navigation.replace('TaskDetail', { taskId })}
    />
  );
}
