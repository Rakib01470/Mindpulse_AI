import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

it('boots, initialises the DB and shows the empty dashboard', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  render(<App />);
  await waitFor(() => expect(screen.getByText('All caught up! Tap the microphone to add a task or start a project timer.')).toBeTruthy());
  expect(log).toHaveBeenCalledWith('Database initialized successfully');
  expect(screen.getByText('Quick Stats')).toBeTruthy();
});
