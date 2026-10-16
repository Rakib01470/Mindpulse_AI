import {
  AiError,
  classifyAiError,
  createAiClient,
  createGeminiClient,
  detectProvider,
  fixGrammar,
  GeminiHttpError,
  parseTaskFromTranscript,
  testApiKey,
} from '../src/services/aiService';
import { GEMINI_MODEL } from '../src/utils/constants';

type Call = { url: string; init: RequestInit & { headers: Record<string, string> } };

/** Fake fetch returning Gemini-shaped responses (format per ai.google.dev API reference). */
function fakeFetch(respond: () => { status: number; body: unknown } | Error) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: Call['init']) => {
    calls.push({ url, init });
    const r = respond();
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const textReply = (text: string, extraParts: object[] = []) => ({
  status: 200,
  body: { candidates: [{ content: { role: 'model', parts: [...extraParts, { text }] }, finishReason: 'STOP' }] },
});

const GEMINI_KEY = 'AIzaSyExampleExampleExampleExample00000';

describe('Gemini — provider detection', () => {
  it('detects provider from the key prefix', () => {
    expect(detectProvider('sk-ant-api03-xyz')).toBe('anthropic');
    expect(detectProvider('  AIzaSyAbc  ')).toBe('gemini');
    expect(detectProvider('sk-proj-openai')).toBeNull();
  });
});

describe('Gemini — request format', () => {
  it('posts generateContent with the key header, system instruction and JSON mode', async () => {
    const f = fakeFetch(() =>
      textReply('{"title":"Review branch audit report","category_name":"Office Work","priority":"High","due_date":null,"due_time":"16:00","summary":"x"}'),
    );
    const parsed = await parseTaskFromTranscript('High priority office task review branch audit report by 4 PM', {
      apiKey: GEMINI_KEY,
      categories: ['Office Work', 'Personal Work'],
      now: new Date(2026, 9, 16, 10, 0),
      client: createGeminiClient(GEMINI_KEY, f.impl),
    });
    expect(parsed).toMatchObject({ title: 'Review branch audit report', category_name: 'Office Work', priority: 'High', due_time: '16:00' });

    const { url, init } = f.calls[0];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`);
    expect(init.method).toBe('POST');
    expect(init.headers['x-goog-api-key']).toBe(GEMINI_KEY);
    expect(url).not.toContain(GEMINI_KEY); // key never in the URL
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toContain('Existing task categories: "Office Work", "Personal Work"');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'High priority office task review branch audit report by 4 PM' }] }]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(1024);
    expect(body.generationConfig).not.toHaveProperty('temperature');
  });

  it('ignores thought parts and joins text parts', async () => {
    const f = fakeFetch(() => textReply('I thought about a new game mechanic for jumping high.', [{ text: 'thinking…', thought: true }]));
    await expect(
      fixGrammar('i thinked about new game mechanic for jumping high', { apiKey: GEMINI_KEY, client: createGeminiClient(GEMINI_KEY, f.impl) }),
    ).resolves.toBe('I thought about a new game mechanic for jumping high.');
    expect(JSON.parse(String(f.calls[0].init.body)).generationConfig).not.toHaveProperty('responseMimeType');
  });

  it('handles a fenced JSON reply too', async () => {
    const f = fakeFetch(() => textReply('```json\n{"title":"Pay bill","category_name":"Personal Work","priority":"Low","due_date":null,"due_time":null,"summary":null}\n```'));
    const t = await parseTaskFromTranscript('pay bill', { apiKey: GEMINI_KEY, categories: [], client: createGeminiClient(GEMINI_KEY, f.impl) });
    expect(t.category_name).toBe('Personal Work');
  });
});

describe('Gemini — error mapping', () => {
  const run = (resp: () => { status: number; body: unknown } | Error) =>
    createGeminiClient(GEMINI_KEY, fakeFetch(resp).impl).complete({ system: 's', user: 'u', maxTokens: 10 });

  it('invalid key (400 "API key not valid") → invalid_key', async () => {
    const e = await run(() => ({
      status: 400,
      body: { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } },
    })).catch((x) => x);
    expect(e).toBeInstanceOf(GeminiHttpError);
    expect(classifyAiError(e)).toBe('invalid_key');
  });

  it('403 → invalid_key; 429 → rate_limited; 500 → other', async () => {
    expect(classifyAiError(await run(() => ({ status: 403, body: { error: { status: 'PERMISSION_DENIED', message: 'denied' } } })).catch((x) => x))).toBe('invalid_key');
    expect(classifyAiError(await run(() => ({ status: 429, body: { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } } })).catch((x) => x))).toBe('rate_limited');
    expect(classifyAiError(await run(() => ({ status: 500, body: { error: { status: 'INTERNAL', message: 'oops' } } })).catch((x) => x))).toBe('other');
  });

  it('offline (fetch throws) → network, so the task is still saved locally', async () => {
    const e = await run(() => new TypeError('Network request failed')).catch((x) => x);
    expect(e).toBeInstanceOf(AiError);
    expect((e as AiError).kind).toBe('network');
    const f = fakeFetch(() => new TypeError('Network request failed'));
    await expect(parseTaskFromTranscript('x', { apiKey: GEMINI_KEY, categories: [], client: createGeminiClient(GEMINI_KEY, f.impl) })).rejects.toMatchObject({ kind: 'network' });
  });

  it('blocked prompt → bad_response (falls back to manual review)', async () => {
    const e = await run(() => ({ status: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } })).catch((x) => x);
    expect((e as AiError).kind).toBe('bad_response');
  });

  it('Test API Key: valid / invalid / rate-limited', async () => {
    const ok = createAiClient(GEMINI_KEY, fakeFetch(() => textReply('OK')).impl);
    await expect(testApiKey(GEMINI_KEY, ok)).resolves.toBe(true);
    const bad = createAiClient(GEMINI_KEY, fakeFetch(() => ({ status: 400, body: { error: { message: 'API key not valid.' } } })).impl);
    await expect(testApiKey(GEMINI_KEY, bad)).resolves.toBe(false);
    const limited = createAiClient(GEMINI_KEY, fakeFetch(() => ({ status: 429, body: { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } } })).impl);
    await expect(testApiKey(GEMINI_KEY, limited)).rejects.toMatchObject({ kind: 'rate_limited' });
  });
});
