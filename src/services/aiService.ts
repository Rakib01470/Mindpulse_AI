// Under Metro the SDK's auto shim resolves to its fetch-based web runtime (verified in the Android bundle).
import Anthropic from '@anthropic-ai/sdk';
import { format } from 'date-fns';
import { AI_MODEL, GRAMMAR_SYSTEM_PROMPT, LIMITS, PRIORITIES, TASK_PARSE_SYSTEM_PROMPT } from '../utils/constants';
import { isHHmm, isIsoDate, toHHmm, toIsoDate } from '../utils/formatting';
import type { Priority } from '../database/types';

export type AiErrorKind = 'missing_key' | 'invalid_key' | 'network' | 'bad_response' | 'other';

export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string, public cause?: unknown) {
    super(message);
    this.name = 'AiError';
  }
}

export interface ParsedTask {
  title: string;
  category_name: string;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  summary: string | null;
}

/** Minimal completion interface — the Anthropic client in the app, a fake in tests. */
export interface AiClient {
  complete(opts: { system: string; user: string; maxTokens: number; temperature?: number }): Promise<string>;
}

export function createAnthropicClient(apiKey: string): AiClient {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // the key is the device owner's own key, stored encrypted on-device
    maxRetries: 1,
    timeout: 20_000,
  });
  return {
    async complete({ system, user, maxTokens, temperature = 0 }) {
      const res = await client.messages.create({
        model: AI_MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: user }],
      });
      return res.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim();
    },
  };
}

/** Maps SDK / fetch failures onto the user-facing error categories of Section 10. */
export function classifyAiError(e: unknown): AiErrorKind {
  if (e instanceof AiError) return e.kind;
  const err = e as { status?: number; name?: string; message?: string; constructor?: { name?: string } };
  if (e instanceof Anthropic.AuthenticationError || err?.status === 401) return 'invalid_key';
  if (e instanceof Anthropic.APIConnectionError) return 'network';
  const label = `${err?.name ?? ''} ${err?.constructor?.name ?? ''} ${err?.message ?? ''}`;
  if (/APIConnection|Network request failed|network|ENOTFOUND|ECONNREFUSED|timed out|timeout|fetch failed/i.test(label)) {
    return 'network';
  }
  return 'other';
}

const toAiError = (e: unknown): AiError => {
  if (e instanceof AiError) return e;
  const kind = classifyAiError(e);
  return new AiError(kind, e instanceof Error ? e.message : String(e), e);
};

/**
 * Pulls a JSON object out of an LLM reply: strips ```json fences and any prose
 * before/after the outermost {...}. Throws AiError('bad_response') if none parses.
 */
export function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AiError('bad_response', 'No JSON object in AI response');
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch (e) {
    throw new AiError('bad_response', 'AI response was not valid JSON', e);
  }
}

/** "3:00" → "03:00", "15:00" stays; anything else → null. */
const normalizeTime = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hhmm = `${m[1].padStart(2, '0')}:${m[2]}`;
  return isHHmm(hhmm) ? hhmm : null;
};

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Validates/coerces the model's JSON into a safe ParsedTask (Section 4 rules). */
export function normalizeParsedTask(raw: unknown, transcript: string): ParsedTask {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

  const fallbackTitle = capitalise(str(transcript)).slice(0, LIMITS.taskTitle) || 'Untitled task';
  const title = capitalise(str(o.title)).slice(0, LIMITS.taskTitle) || fallbackTitle;
  const pRaw = str(o.priority).toLowerCase();
  const priority = (PRIORITIES.find((p) => p.toLowerCase() === pRaw) ?? 'Medium') as Priority;
  const due_date = isIsoDate(str(o.due_date)) ? str(o.due_date) : null;
  const due_time = normalizeTime(o.due_time);
  const category_name = str(o.category_name).slice(0, LIMITS.categoryName) || 'Office Work';
  const summary = str(o.summary) || null;

  return { title, category_name, priority, due_date, due_time, summary };
}

/** Raw transcript as a task with default fields — the offline / no-key fallback (F1). */
export function fallbackTask(transcript: string): ParsedTask {
  return normalizeParsedTask({}, transcript);
}

export async function parseTaskFromTranscript(
  transcript: string,
  opts: { apiKey: string | null; categories: string[]; now?: Date; client?: AiClient },
): Promise<ParsedTask> {
  if (!opts.apiKey && !opts.client) throw new AiError('missing_key', 'API key missing');
  const now = opts.now ?? new Date();
  const client = opts.client ?? createAnthropicClient(opts.apiKey!);
  const system = TASK_PARSE_SYSTEM_PROMPT({
    today: toIsoDate(now),
    weekday: format(now, 'EEEE'),
    nowTime: toHHmm(now),
    categories: opts.categories,
  });
  let reply: string;
  try {
    reply = await client.complete({ system, user: transcript, maxTokens: 400 });
  } catch (e) {
    throw toAiError(e);
  }
  return normalizeParsedTask(extractJson(reply), transcript);
}

/** Removes wrappers models sometimes add despite instructions. */
export function cleanGrammarReply(reply: string): string {
  let t = reply.trim();
  const fence = t.match(/^```[a-zA-Z]*\s*([\s\S]*?)```$/);
  if (fence) t = fence[1].trim();
  t = t.replace(/^(here is|here's) (the )?(corrected|refined|cleaned[- ]up) (text|version)[^:\n]*:\s*/i, '');
  return t.trim();
}

export async function fixGrammar(text: string, opts: { apiKey: string | null; client?: AiClient }): Promise<string> {
  if (!opts.apiKey && !opts.client) throw new AiError('missing_key', 'API key missing');
  const client = opts.client ?? createAnthropicClient(opts.apiKey!);
  try {
    const reply = await client.complete({
      system: GRAMMAR_SYSTEM_PROMPT,
      user: text,
      maxTokens: Math.min(8000, Math.max(256, Math.ceil(text.length / 2))),
    });
    const cleaned = cleanGrammarReply(reply);
    if (!cleaned) throw new AiError('bad_response', 'Empty AI response');
    return cleaned;
  } catch (e) {
    throw toAiError(e);
  }
}

/**
 * Lightweight validity check (F6). Resolves true (valid) or false (401/403 — key rejected).
 * Any other failure (network, model unavailable, overload) rejects with an AiError so the UI
 * does not mislabel it as an invalid key.
 */
export async function testApiKey(apiKey: string, client?: AiClient): Promise<boolean> {
  const c = client ?? createAnthropicClient(apiKey);
  try {
    await c.complete({ system: 'Reply with OK.', user: 'ping', maxTokens: 1 });
    return true;
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (classifyAiError(e) === 'invalid_key' || status === 403) return false;
    throw toAiError(e);
  }
}
