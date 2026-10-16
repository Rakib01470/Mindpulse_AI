import { freshDb } from './helpers/nodeDb';
import { getSetting } from '../src/database/settingsDao';
import { loadVoiceLanguage, saveVoiceLanguage } from '../src/services/voiceLanguageStore';
import { normalizeParsedTask, parseTaskFromTranscript, type AiClient } from '../src/services/aiService';
import { SETTINGS_KEYS } from '../src/utils/constants';

describe('Voice language setting', () => {
  it('defaults to English and persists Bengali in the settings table', async () => {
    const db = await freshDb();
    await expect(loadVoiceLanguage(db)).resolves.toBe('en-US');
    await saveVoiceLanguage(db, 'bn-BD');
    expect(await getSetting(db, SETTINGS_KEYS.voiceLanguage)).toBe('bn-BD');
    await expect(loadVoiceLanguage(db)).resolves.toBe('bn-BD');
    await saveVoiceLanguage(db, 'en-US');
    await expect(loadVoiceLanguage(db)).resolves.toBe('en-US');
  });
});

describe('Bengali task parsing', () => {
  const transcript = 'জরুরি অফিসের কাজ আগামীকাল বিকেল ৪টার মধ্যে শাখা অডিট রিপোর্ট দেখতে হবে';

  it('tells the model to keep the title in Bengali and sends the transcript unchanged', async () => {
    const calls: { system: string; user: string }[] = [];
    const client: AiClient = {
      complete: async (o) => {
        calls.push(o);
        return '{"title":"শাখা অডিট রিপোর্ট দেখা","category_name":"Office Work","priority":"High","due_date":"2026-10-14","due_time":"16:00","summary":"আগামীকাল বিকেল ৪টার মধ্যে শাখা অডিট রিপোর্ট দেখতে হবে।"}';
      },
    };
    const parsed = await parseTaskFromTranscript(transcript, {
      apiKey: 'k',
      categories: ['Office Work', 'Personal Work'],
      now: new Date(2026, 9, 13, 10, 15),
      client,
    });
    expect(calls[0].user).toBe(transcript);
    expect(calls[0].system).toContain('Do NOT translate a Bengali task into English');
    expect(parsed).toEqual({
      title: 'শাখা অডিট রিপোর্ট দেখা',
      category_name: 'Office Work',
      priority: 'High',
      due_date: '2026-10-14',
      due_time: '16:00',
      summary: 'আগামীকাল বিকেল ৪টার মধ্যে শাখা অডিট রিপোর্ট দেখতে হবে।',
    });
  });

  it('accepts Bengali digits in date and time, and keeps a Bengali raw transcript as fallback title', () => {
    const t = normalizeParsedTask({ title: '', due_date: '২০২৬-১০-১৪', due_time: '৪:৩০' }, '  ব্যাংকে টাকা জমা দেওয়া ');
    expect(t.due_date).toBe('2026-10-14');
    expect(t.due_time).toBe('04:30');
    expect(t.title).toBe('ব্যাংকে টাকা জমা দেওয়া');
  });
});
