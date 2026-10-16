// Must load first: installs the fake fetch before the Anthropic SDK captures global fetch.
import { fetchCalls, goToTab, queueAnthropic as queueReply } from './helpers';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

it('works end to end with a Gemini key', async () => {
  render(<App />);
  await waitFor(() => screen.getByText('Quick Stats'));

  await goToTab('Settings');
  fireEvent.changeText(screen.getByLabelText('AI API key'), 'AIzaSyExampleExampleExampleExample00000');
  expect(screen.getByText(/Using: Google Gemini/)).toBeTruthy();
  expect(screen.getByText(/Gemini free tier: Google may use what you send/)).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Save Key')));
  await waitFor(() => screen.getByText(/Saved \(encrypted on this device\): AIzaSyExam…0000/));

  queueReply({ text: 'OK' });
  await act(async () => fireEvent.press(screen.getByText('Test API Key')));
  await waitFor(() => screen.getByText('Valid Key'));
  expect(fetchCalls[0].url).toContain('generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');

  await goToTab('Dashboard');
  await act(async () => fireEvent.press(screen.getByLabelText('Capture task by voice')));
  fireEvent.changeText(screen.getByPlaceholderText(/High priority office task/), 'High priority office task review branch audit report by 4 PM');
  queueReply({ text: '{"title":"Review branch audit report","category_name":"Office Work","priority":"High","due_date":null,"due_time":"16:00","summary":"Review the branch audit report by 4 PM."}' });
  await act(async () => fireEvent.press(screen.getByText('Process with AI')));
  await waitFor(() => screen.getByText('Review AI-parsed task'));
  expect(screen.getByDisplayValue('Review branch audit report')).toBeTruthy();
  expect(screen.getByText('04:00 PM')).toBeTruthy();
  expect(fetchCalls[1].body.generationConfig).toMatchObject({ responseMimeType: 'application/json' });
  await act(async () => fireEvent.press(screen.getByText('Save Task')));
  await waitFor(() => screen.getByText('Urgent Focus'));
});
