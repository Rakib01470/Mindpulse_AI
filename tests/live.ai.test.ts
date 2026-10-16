/**
 * Live checks against the real Anthropic API — skipped unless ANTHROPIC_API_KEY is set.
 *   ANTHROPIC_API_KEY=sk-ant-... npx jest tests/live.ai.test.ts
 * Covers the Phase 2 and Phase 5 verification checkpoints end-to-end (minus the microphone).
 *   GEMINI_API_KEY=AIza... npx jest tests/live.ai.test.ts   (Gemini variant)
 */
import { addDays } from 'date-fns';
import { createAnthropicClient, fixGrammar, parseTaskFromTranscript, testApiKey } from '../src/services/aiService';
import { toIsoDate } from '../src/utils/formatting';

const key = process.env.ANTHROPIC_API_KEY;
const live = key ? describe : describe.skip;

live('LIVE Anthropic API', () => {
  const categories = ['Office Work', 'Personal Work'];
  const now = new Date(2026, 9, 13, 10, 0); // Tue 13 Oct 2026, 10:00

  it('accepts the key', async () => {
    await expect(testApiKey(key!)).resolves.toBe(true);
  });

  it('rejects a bad key', async () => {
    await expect(testApiKey('sk-ant-invalid-key-for-test')).resolves.toBe(false);
  });

  it('Phase 2 checkpoint: "review branch audit report by 4 PM"', async () => {
    const t = await parseTaskFromTranscript('High priority office task review branch audit report by 4 PM', {
      apiKey: key!,
      categories,
      now,
      client: createAnthropicClient(key!),
    });
    console.log('Parsed JSON:', JSON.stringify(t, null, 2));
    expect(t.title.toLowerCase()).toContain('branch audit report');
    expect(t.category_name).toBe('Office Work');
    expect(t.priority).toBe('High');
    expect(t.due_time).toBe('16:00');
  });

  it('F1 acceptance: "submit quarterly tax report by tomorrow 3 PM"', async () => {
    const t = await parseTaskFromTranscript('High priority office task submit quarterly tax report by tomorrow 3 PM', {
      apiKey: key!,
      categories,
      now,
    });
    console.log('Parsed JSON:', JSON.stringify(t, null, 2));
    expect(t.title).toBe('Submit quarterly tax report');
    expect(t.category_name).toBe('Office Work');
    expect(t.priority).toBe('High');
    expect(t.due_date).toBe(toIsoDate(addDays(now, 1)));
    expect(t.due_time).toBe('15:00');
  });

  it('Phase 5 checkpoint: grammar fix', async () => {
    const out = await fixGrammar('i thinked about new game mechanic for jumping high', { apiKey: key! });
    console.log('Grammar:', out);
    expect(out).toMatch(/^I thought about a new game mechanic for jumping high\.?$/);
  });
});

const gemini = process.env.GEMINI_API_KEY;
(gemini ? describe : describe.skip)('LIVE Google Gemini API', () => {
  const now = new Date(2026, 9, 13, 10, 0);
  it('accepts the key', async () => {
    await expect(testApiKey(gemini!)).resolves.toBe(true);
  });
  it('Phase 2 checkpoint via Gemini', async () => {
    const t = await parseTaskFromTranscript('High priority office task review branch audit report by 4 PM', {
      apiKey: gemini!,
      categories: ['Office Work', 'Personal Work'],
      now,
    });
    console.log('Gemini parsed JSON:', JSON.stringify(t, null, 2));
    expect(t.category_name).toBe('Office Work');
    expect(t.priority).toBe('High');
    expect(t.due_time).toBe('16:00');
  });
  it('grammar fix via Gemini', async () => {
    const out = await fixGrammar('i thinked about new game mechanic for jumping high', { apiKey: gemini! });
    console.log('Gemini grammar:', out);
    expect(out.toLowerCase()).toContain('i thought about');
  });
});
