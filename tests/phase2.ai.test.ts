import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  AiError,
  classifyAiError,
  cleanGrammarReply,
  extractJson,
  fallbackTask,
  fixGrammar,
  normalizeParsedTask,
  parseTaskFromTranscript,
  testApiKey,
  type AiClient,
} from '../src/services/aiService';
import { decryptString, encryptString, utf8Decode, utf8Encode } from '../src/utils/keyCipher';

const sha256 = async (d: Uint8Array) => new Uint8Array(createHash('sha256').update(d).digest());
const fake = (reply: string | (() => never)): AiClient & { calls: { system: string; user: string }[] } => {
  const calls: { system: string; user: string }[] = [];
  return {
    calls,
    complete: async (o) => {
      calls.push({ system: o.system, user: o.user });
      if (typeof reply === 'function') return reply();
      return reply;
    },
  };
};

describe('Phase 2 — API key encryption at rest', () => {
  const key = new Uint8Array(32).fill(7);
  const nonce = new Uint8Array(16).fill(3);

  it('round-trips and never stores the plaintext', async () => {
    const secret = 'sk-ant-api03-EXAMPLE_example-1234567890';
    const blob = await encryptString(secret, key, nonce, sha256);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(blob).not.toContain('sk-ant');
    await expect(decryptString(blob, key, sha256)).resolves.toBe(secret);
  });

  it('rejects a tampered ciphertext or wrong master key', async () => {
    const blob = await encryptString('sk-ant-xyz', key, nonce, sha256);
    const parts = blob.split(':');
    parts[2] = (parts[2][0] === '0' ? '1' : '0') + parts[2].slice(1);
    await expect(decryptString(parts.join(':'), key, sha256)).rejects.toThrow();
    await expect(decryptString(blob, new Uint8Array(32).fill(8), sha256)).rejects.toThrow();
  });

  it('UTF-8 helpers handle Bangla and emoji', () => {
    const s = 'ঢাকা ৳১২ 🚀';
    expect(utf8Decode(utf8Encode(s))).toBe(s);
    expect(Buffer.from(utf8Encode(s)).toString('utf8')).toBe(s);
  });
});

describe('Phase 2 — AI JSON extraction (Section 9)', () => {
  it('strips ```json fences before parsing', () => {
    expect(extractJson('```json\n{"title":"A"}\n```')).toEqual({ title: 'A' });
    expect(extractJson('```\n{"title":"B"}\n```')).toEqual({ title: 'B' });
  });
  it('ignores prose around the object', () => {
    expect(extractJson('Sure! Here it is: {"a":1,"b":{"c":2}} Hope that helps')).toEqual({ a: 1, b: { c: 2 } });
  });
  it('throws a bad_response AiError when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow(AiError);
    try {
      extractJson('{not json}');
    } catch (e) {
      expect((e as AiError).kind).toBe('bad_response');
    }
  });
});

describe('Phase 2 — task normalisation', () => {
  it('coerces enums, formats and lengths', () => {
    const t = normalizeParsedTask(
      { title: 'x'.repeat(200), priority: 'high', due_date: '2026-02-30', due_time: '4:00', category_name: '', summary: '' },
      'raw',
    );
    expect(t.title).toHaveLength(150);
    expect(t.priority).toBe('High');
    expect(t.due_date).toBeNull(); // invalid calendar date
    expect(t.due_time).toBe('04:00');
    expect(t.category_name).toBe('Office Work');
    expect(t.summary).toBeNull();
  });
  it('falls back to the raw transcript as title with default fields', () => {
    expect(fallbackTask('  call the auditor about the vault report  ')).toEqual({
      title: 'Call the auditor about the vault report',
      category_name: 'Office Work',
      priority: 'Medium',
      due_date: null,
      due_time: null,
      summary: null,
    });
  });
});

describe('Phase 2 — checkpoint pipeline: "High priority office task review branch audit report by 4 PM"', () => {
  const now = new Date(2026, 9, 13, 10, 15); // Tue 13 Oct 2026 10:15 local
  const transcript = 'High priority office task review branch audit report by 4 PM';

  it('sends today, weekday, current time and the category list to the model', async () => {
    const client = fake('{"title":"Review branch audit report","category_name":"Office Work","priority":"High","due_date":"2026-10-13","due_time":"16:00","summary":"Review the branch audit report by 4 PM."}');
    const parsed = await parseTaskFromTranscript(transcript, {
      apiKey: 'sk-ant-test',
      categories: ['Office Work', 'Personal Work'],
      now,
      client,
    });
    expect(client.calls[0].user).toBe(transcript);
    expect(client.calls[0].system).toContain('Tuesday, 2026-10-13');
    expect(client.calls[0].system).toContain('10:15');
    expect(client.calls[0].system).toContain('"Office Work", "Personal Work"');
    expect(parsed).toEqual({
      title: 'Review branch audit report',
      category_name: 'Office Work',
      priority: 'High',
      due_date: '2026-10-13',
      due_time: '16:00',
      summary: 'Review the branch audit report by 4 PM.',
    });
  });

  it('handles a fenced reply the same way', async () => {
    const client = fake('```json\n{"title":"Review branch audit report","category_name":"Office Work","priority":"High","due_date":null,"due_time":"16:00","summary":null}\n```');
    const parsed = await parseTaskFromTranscript(transcript, { apiKey: 'k', categories: [], now, client });
    expect(parsed.due_time).toBe('16:00');
    expect(parsed.priority).toBe('High');
  });

  it('reports missing key without calling the network', async () => {
    await expect(parseTaskFromTranscript(transcript, { apiKey: null, categories: [] })).rejects.toMatchObject({ kind: 'missing_key' });
  });
});

describe('Phase 2 — error classification (Section 10)', () => {
  const headers = {};
  it('401 → invalid_key', () => {
    const e = new Anthropic.AuthenticationError(401, { error: { type: 'authentication_error' } }, 'invalid x-api-key', headers);
    expect(classifyAiError(e)).toBe('invalid_key');
  });
  it('connection failure → network', () => {
    expect(classifyAiError(new Anthropic.APIConnectionError({ message: 'Connection error.' }))).toBe('network');
    expect(classifyAiError(new TypeError('Network request failed'))).toBe('network');
    expect(classifyAiError(new Anthropic.APIConnectionTimeoutError())).toBe('network');
  });
  it('other server errors → other', () => {
    expect(classifyAiError(new Anthropic.InternalServerError(500, {}, 'boom', headers))).toBe('other');
  });
  it('parse wraps transport errors in AiError with the right kind', async () => {
    const client = fake(() => {
      throw new Anthropic.APIConnectionError({ message: 'Connection error.' });
    });
    await expect(parseTaskFromTranscript('x', { apiKey: 'k', categories: [], client })).rejects.toMatchObject({ kind: 'network' });
  });
  it('testApiKey: true on success, false on 401/403, throws on network or other errors', async () => {
    await expect(
      testApiKey('k', fake(() => { throw new Anthropic.NotFoundError(404, {}, 'model: not_found', headers); })),
    ).rejects.toMatchObject({ kind: 'other' });
    await expect(
      testApiKey('k', fake(() => { throw new Anthropic.PermissionDeniedError(403, {}, 'forbidden', headers); })),
    ).resolves.toBe(false);
    await expect(testApiKey('k', fake('OK'))).resolves.toBe(true);
    await expect(
      testApiKey('k', fake(() => { throw new Anthropic.AuthenticationError(401, {}, 'bad', headers); })),
    ).resolves.toBe(false);
    await expect(
      testApiKey('k', fake(() => { throw new Anthropic.APIConnectionError({ message: 'x' }); })),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('Phase 2 — grammar reply cleaning', () => {
  it('removes fences and preambles', () => {
    expect(cleanGrammarReply('```\nI thought about it.\n```')).toBe('I thought about it.');
    expect(cleanGrammarReply("Here's the corrected text:\nI thought about it.")).toBe('I thought about it.');
  });
  it('fixGrammar returns the cleaned model output', async () => {
    const client = fake('I thought about a new game mechanic for jumping high.');
    await expect(fixGrammar('i thinked about new game mechanic for jumping high', { apiKey: 'k', client })).resolves.toBe(
      'I thought about a new game mechanic for jumping high.',
    );
    expect(client.calls[0].system).toContain('preserving exact meaning');
  });
});
