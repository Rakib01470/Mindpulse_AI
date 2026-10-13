import { Alert } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

/** Alerts are recorded; each one auto-presses the next queued button label (or nothing). */
export const alerts: { title: string; message?: string }[] = [];
const choices: string[] = [];
export const chooseInNextAlert = (label: string) => choices.push(label);

jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
  alerts.push({ title, message });
  const want = choices.shift();
  const btn = buttons?.find((b) => b.text === want);
  if (btn?.onPress) setTimeout(() => btn.onPress?.(), 0);
});

/** Fake Anthropic Messages API behind global fetch. */
type Reply = { text: string } | { status: number } | { networkError: true };
const replies: Reply[] = [];
export const fetchCalls: { url: string; body: Record<string, unknown> }[] = [];
export const queueAnthropic = (r: Reply) => replies.push(r);

const fakeResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  url: 'https://api.anthropic.com/v1/messages',
  headers: {
    get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null),
    forEach: () => undefined,
    entries: () => [][Symbol.iterator](),
  },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

global.fetch = jest.fn(async (url: unknown, init?: { body?: string }) => {
  fetchCalls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : {} });
  const r = replies.shift() ?? { status: 500 };
  if ('networkError' in r) throw new TypeError('Network request failed');
  if ('status' in r) {
    return fakeResponse(r.status, { type: 'error', error: { type: r.status === 401 ? 'authentication_error' : 'api_error', message: 'x' } });
  }
  return fakeResponse(200, {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text: r.text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}) as unknown as typeof fetch;

/** Taps a bottom tab by its label (the tab label is the last matching text). */
export const goToTab = async (name: string) => {
  const all = screen.getAllByText(name);
  await act(async () => {
    fireEvent.press(all[all.length - 1]);
  });
};

export const flush = (ms = 50) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
