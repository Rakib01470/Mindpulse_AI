import React, { useCallback, useEffect, useRef } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { NoteEditor } from '../components/notes/NoteEditor';

type Props = NativeStackScreenProps<RootStackParamList, 'NoteEditor'>;

export function NoteEditorScreen({ route, navigation }: Props) {
  const flush = useRef<() => Promise<void>>(async () => undefined);
  const registerFlush = useCallback((f: () => Promise<void>) => {
    flush.current = f;
  }, []);

  // Save any unsaved edits when leaving the editor (back button, gesture, or navigation).
  useEffect(() => navigation.addListener('beforeRemove', () => void flush.current()), [navigation]);

  return (
    <NoteEditor
      noteId={route.params?.noteId}
      initialTopic={route.params?.topic}
      registerFlush={registerFlush}
      onDeleted={() => navigation.goBack()}
    />
  );
}
