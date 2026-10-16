/** App-wide constants: default categories, AI model, prompt templates, user-facing messages. */

export const APP_NAME = 'MindPulse AI';

export const CATEGORY_OFFICE_ID = 'cat_office';
export const CATEGORY_PERSONAL_ID = 'cat_personal';

export const DEFAULT_CATEGORIES = [
  { id: CATEGORY_OFFICE_ID, name: 'Office Work' },
  { id: CATEGORY_PERSONAL_ID, name: 'Personal Work' },
] as const;

/**
 * The plan pins claude-3-5-haiku-20241022, which Anthropic retired on
 * 19 Feb 2026 (requests now fail). Current Haiku-class model used instead.
 * See DECISIONS.md, D-01.
 */
export const AI_MODEL = 'claude-haiku-5-5';

/**
 * Google Gemini alternative (DECISIONS.md D-34). Flash-Lite: free tier, fastest 3.5 model,
 * thinking defaults to "minimal" which suits short parsing/cleanup jobs.
 */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const TASK_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;
export const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed'] as const;

export const LIMITS = {
  taskTitle: 150,
  projectTitle: 100,
  maxTargetHours: 10000,
  noteTopic: 50,
  categoryName: 50,
  listSummaryChars: 100,
} as const;

export const SETTINGS_KEYS = {
  apiKeyCipher: 'anthropic_api_key',
  activeTimer: 'active_timer',
  voiceLanguage: 'voice_language',
} as const;

/** Dictation languages offered in Settings (BCP-47 tags passed to the Android recognizer). */
export const VOICE_LANGUAGES = [
  { tag: 'en-US', label: 'English' },
  { tag: 'bn-BD', label: 'বাংলা (Bengali)' },
] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]['tag'];
export const DEFAULT_VOICE_LANGUAGE: VoiceLanguage = 'en-US';

export const NOTE_AUTOSAVE_MS = 5000;
export const SPEECH_SILENCE_TIMEOUT_MS = 5000;

/** Exact user-facing strings from Sections 5 and 10. */
export const MESSAGES = {
  dbReady: 'Database initialized successfully',
  parsing: 'Parsing task with AI...',
  networkFallback: 'Network unavailable. Saved raw voice input to Task Title for manual editing.',
  apiKeyMissing: 'AI API Key missing. Please set your Anthropic or Gemini API Key in Settings to enable AI parsing.',
  rateLimited: 'AI limit reached (Gemini free tier allows a limited number of requests per minute). Please try again shortly.',
  apiKeyInvalid: 'Invalid API Key. Please verify your key in Settings and try again.',
  audioPermission:
    'Audio permission is required for voice input. Please enable microphone access in device Settings.',
  noSpeech: 'No speech detected. Please tap the microphone and try again.',
  speechUnavailable:
    'Voice recognition is not available in this build (Expo Go). Type your task below, or install the development build to dictate.',
  categoryExists: 'Category already exists',
  deleteCategory: (name: string) =>
    `Delete category '${name}'? Associated tasks will be moved to 'Personal Work'.`,
  timerRunning: (title: string) =>
    `A timer is already running for '${title}'. Pause or save current session first?`,
  grammarOffline: 'Internet required for AI grammar correction.',
  importInvalid: 'Invalid backup file format. Operation cancelled.',
  dashboardEmpty: 'All caught up! Tap the microphone to add a task or start a project timer.',
  validKey: 'Valid Key',
  invalidKey: 'Invalid Key',
} as const;

export const TASK_PARSE_SYSTEM_PROMPT = (opts: {
  today: string;
  weekday: string;
  nowTime: string;
  categories: string[];
}) => `You convert a dictated to-do item into structured JSON for a task manager.

Context:
- Today is ${opts.weekday}, ${opts.today} (YYYY-MM-DD). Current local time is ${opts.nowTime} (24h). Timezone: Asia/Dhaka. The week starts on Sunday.
- Existing task categories: ${opts.categories.map((c) => `"${c}"`).join(', ')}.
- The dictation may be in English, Bengali (বাংলা) or a mix of both.

Language rules:
- Write "title" and "summary" in the language the task was spoken in. Do NOT translate a Bengali task into English; keep Bengali script and keep English words the speaker used as they are.
- "category_name" is always an existing category name exactly as listed above (Bengali "অফিস"/"কাজ"/"ব্যাংক" -> "Office Work"; "ব্যক্তিগত"/"বাসা"/"বাড়ি" -> "Personal Work").
- "priority", "due_date" and "due_time" always use the English values and ASCII digits 0-9, never Bengali digits (০-৯).
- Bengali dates and times: "আজ" = today, "আগামীকাল"/"কাল" = tomorrow, "পরশু" = the day after tomorrow, "আগামী সপ্তাহ" = next week; "সকাল" = morning (AM), "দুপুর" = midday (12-15), "বিকাল"/"বিকেল" = afternoon (PM, "বিকেল ৩টা" -> "15:00"), "সন্ধ্যা" = evening (PM), "রাত" = night (PM, "রাত ১০টা" -> "22:00"); "টা"/"টায়" after a number means o'clock.
- Bengali "জরুরি"/"খুব গুরুত্বপূর্ণ"/"এখনই" -> "High"; "কম গুরুত্বপূর্ণ" -> "Low".

Return ONLY a JSON object, no prose and no code fences, with exactly these keys:
{
  "title": string,          // short imperative task title, max 150 chars, without the priority/category/date words. Capitalise the first letter.
  "category_name": string,  // reuse an existing category when it fits ("office"/"work"/"bank" -> "Office Work"; "personal"/"home" -> "Personal Work"). Only invent a new short category name if the speaker explicitly names one that does not exist.
  "priority": "High" | "Medium" | "Low",  // "Medium" if not stated; "urgent"/"important"/"ASAP" -> "High"
  "due_date": string | null, // YYYY-MM-DD resolved against today ("tomorrow", "Friday" = the next upcoming Friday, "next week" = next Sunday). If only a time is given, use today unless that time has already passed, then tomorrow. null if no date or time.
  "due_time": string | null, // HH:mm 24-hour ("3 PM" -> "15:00", "noon" -> "12:00"). null if no time.
  "summary": string          // one sentence restating the task with any extra detail; may repeat the title
}

Example input: "High priority office task submit quarterly tax report by tomorrow 3 PM"
Example output: {"title":"Submit quarterly tax report","category_name":"Office Work","priority":"High","due_date":"<tomorrow's date>","due_time":"15:00","summary":"Submit the quarterly tax report by 3 PM tomorrow."}

Example input: "জরুরি অফিসের কাজ আগামীকাল বিকেল ৩টার মধ্যে ত্রৈমাসিক ট্যাক্স রিপোর্ট জমা দিতে হবে"
Example output: {"title":"ত্রৈমাসিক ট্যাক্স রিপোর্ট জমা দেওয়া","category_name":"Office Work","priority":"High","due_date":"<tomorrow's date>","due_time":"15:00","summary":"আগামীকাল বিকেল ৩টার মধ্যে ত্রৈমাসিক ট্যাক্স রিপোর্ট জমা দিতে হবে।"}`;

export const GRAMMAR_SYSTEM_PROMPT =
  'Correct spelling, grammar, and format into clean readable paragraphs/bullet points while preserving exact meaning. ' +
  'Do not add new ideas, do not remove information, and keep the original language and voice. ' +
  'Return ONLY the corrected text — no preamble, no explanations, no quotation marks, no code fences.';
