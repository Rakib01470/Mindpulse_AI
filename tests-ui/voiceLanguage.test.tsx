import { goToTab } from './helpers';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

// A development build: the speech module is present (setup.ts simulates Expo Go without it).
const mockStart = jest.fn();
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: () => true,
    getPermissionsAsync: async () => ({ granted: true }),
    requestPermissionsAsync: async () => ({ granted: true }),
    getSpeechRecognitionServices: () => ['com.google.android.tts'],
    addListener: () => ({ remove: () => undefined }),
    start: (opts: unknown) => mockStart(opts),
    stop: () => undefined,
    abort: () => undefined,
  },
}));

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

it('dictates in the voice language chosen in Settings', async () => {
  render(<App />);
  await waitFor(() => screen.getByText('Quick Stats'));

  await act(async () => fireEvent.press(screen.getByLabelText('Capture task by voice')));
  await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
  expect(mockStart.mock.calls[0][0]).toMatchObject({ lang: 'en-US', androidRecognitionServicePackage: 'com.google.android.tts' });
  await act(async () => fireEvent.press(screen.getByLabelText('Close')));

  await goToTab('Settings');
  await act(async () => fireEvent.press(screen.getByLabelText('Voice language বাংলা (Bengali)')));

  await goToTab('Dashboard');
  await act(async () => fireEvent.press(screen.getByLabelText('Capture task by voice')));
  await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(2));
  expect(mockStart.mock.calls[1][0]).toMatchObject({ lang: 'bn-BD' });
});
