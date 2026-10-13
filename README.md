# MindPulse AI

A local-first Android productivity app: capture tasks by voice and let Claude sort them, track hours on side projects with a live stopwatch, and keep topic-organised notes with one-tap AI grammar clean-up. Everything is stored in SQLite on the phone — no account, no server, no cloud database.

## Features

| | |
|---|---|
| **Voice task capture (F1)** | Tap the mic, speak ("High priority office task submit quarterly tax report by tomorrow 3 PM"), and Claude fills in title, category, priority, due date/time and summary. Review, then **Save Task**. Without a key or network it falls back to the raw transcript. |
| **Tasks & categories (F2)** | Office Work / Personal Work plus your own categories. Filter by category, status, priority and text. Progress slider (100% auto-completes), checkbox with strike-through, overdue highlighting. |
| **Project hours (F3)** | Projects with target hours and a progress bar ("14.5 / 50 hrs (29%)"). One live stopwatch at a time, sticky above the tab bar on every tab, survives app restarts. Session notes, manual time entry, session log. |
| **Notes + AI grammar (F4)** | Notes grouped by topic, search, 5-second auto-save, dictation (dev build), **Fix Grammar & Format** with a word-level before/after diff and Accept / Reject. |
| **Dashboard (F5)** | Today's date, voice button, Urgent Focus (top 3 high-priority or overdue), project progress with Resume Timer, quick stats (completed today, hours this week from Sunday), recent notes. |
| **Settings & backup (F6)** | Anthropic API key stored encrypted, Test API Key, category management, JSON export via the Android share sheet and import with Overwrite / Cancel. |

Display formats follow Bangladesh conventions: dates `dd-mm-yyyy`, 12-hour time with AM/PM, lakh grouping (`12,34,567`), weeks start on Sunday.

## Architecture

```
┌──────────────────────── UI (React Native Paper, dark MD3) ─────────────────────────┐
│ Dashboard │ Tasks │ Projects │ Notes │ Settings      + VoiceCapture / TaskDetail /  │
│           (bottom tabs, sticky TimerWidget)            ProjectDetail / NoteEditor   │
└───────────────┬───────────────────────────────────────────────┬────────────────────┘
                │ hooks: useTasks · useProjects/useTimer · useNotes · useDatabase      │
┌───────────────▼──────────── Context providers (state) ──────────────────────────────┐
│ DatabaseContext → TasksContext → ProjectsContext (live timer) → NotesContext        │
└───────┬──────────────────────────────┬──────────────────────────────┬──────────────┘
        │ DAO layer (plain SQL)        │ services                     │ utils (pure)
┌───────▼────────────┐  ┌──────────────▼───────────────┐  ┌───────────▼──────────────┐
│ db.ts (schema)     │  │ aiService   → Anthropic API  │  │ formatting · timer       │
│ tasksDao           │  │ speechService → Android STT  │  │ keyCipher · wordDiff     │
│ projectsDao        │  │ backupService → share/picker │  │ taskFilters · constants  │
│ notesDao           │  │ apiKeyStore → SecureStore    │  └──────────────────────────┘
│ settingsDao        │  └──────────────────────────────┘
│ dashboardDao       │
└───────┬────────────┘
        ▼
  expo-sqlite  (mindpulse.db on device)
```

```
mindpulse-app/
├── App.tsx                 # providers + NavigationContainer
├── index.ts                # entry (URL polyfill, registerRootComponent)
├── app.json / eas.json     # Expo + EAS build config (RECORD_AUDIO, speech plugin)
├── DECISIONS.md            # every place the plan was ambiguous and what was chosen
├── src/
│   ├── components/{common,dashboard,tasks,projects,notes,voice,settings}/
│   ├── context/            # DatabaseContext, TasksContext, ProjectsContext, NotesContext
│   ├── database/           # db.ts schema + DAOs (tasks, projects, notes, settings, dashboard)
│   ├── navigation/         # AppNavigator (tabs + stack), route types
│   ├── screens/            # 5 tabs + detail/editor/voice screens
│   ├── services/           # aiService, speechService, backupService, apiKeyStore
│   └── utils/              # formatting, timer, constants, theme, keyCipher, wordDiff
└── tests/                  # Jest: unit + DAO tests on a real SQLite engine
```

## Setup and running

Prerequisites: Node.js 18+ (20+ recommended), an Android phone, and an [Anthropic API key](https://console.anthropic.com/).

```bash
cd mindpulse-app
npm install
npx expo start
```

### Expo Go vs development build — read this

`expo-speech-recognition` (native Android speech) is a custom native module and **is not included in Expo Go**.

- **Expo Go** (scan the QR code): everything works except dictation. The voice screen shows a text box instead — type the task and tap *Process with AI* to use the same AI parsing.
- **Development build** (full voice): build once, then iterate with `npx expo start` as usual.

```bash
npm install -g eas-cli
eas login
eas build -p android --profile development   # installable dev client APK
```

### Standalone APK

```bash
eas build:configure          # first time only
eas build -p android --profile preview
```

Download the `.apk` from the link EAS prints and install it on the phone (allow "Install unknown apps").

### First run

1. **Settings → Anthropic API Key** → paste `sk-ant-...` → **Save Key** → **Test API Key** (green "Valid Key").
2. Tap the mic on the Dashboard and say a task.
3. **Projects → New Project** ("3D Asset Dev", 50 hrs) → **Start Session**.

The model is set in `src/utils/constants.ts` (`AI_MODEL`, default `claude-haiku-5-5`).

## Data: SQLite and backups

- Database file: `mindpulse.db` in the app's private storage, created on first launch (`src/database/db.ts`). Tables: `categories`, `tasks`, `projects`, `time_logs`, `notes`, `settings`. Foreign keys are on; schema version is tracked with `PRAGMA user_version` for future migrations.
- **API key**: encrypted with a random master key held in Android Keystore (expo-secure-store); only ciphertext is in `settings`. Clearing app data removes both.
- **Export**: Settings → *Export Data* writes `mindpulse-backup-YYYY-MM-DD.json` and opens the share sheet (save to Drive, Files, email…). It contains all five data tables; it never contains settings or your API key.
- **Import**: Settings → *Import Data* → choose the file → the app validates structure, types, enums and references, shows counts, then **Overwrite** or **Cancel**. The restore runs in one transaction; if anything fails, your existing data is untouched and you see "Invalid backup file format. Operation cancelled."
- Inspecting the DB during development: `adb exec-out run-as com.mindpulse.ai cat databases/SQLite/mindpulse.db > mindpulse.db` (debuggable builds), then open it with any SQLite browser.

## Testing

```bash
npx tsc --noEmit     # strict type-check
npx eslint .         # lint
npx jest             # 71 tests: formatting, AI parsing, encryption, every DAO, timer, backup round-trip
ANTHROPIC_API_KEY=sk-ant-... npx jest tests/live.ai.test.ts   # optional: real-API checks for the phase checkpoints
```

The DAO tests run the app's real SQL on Node's built-in SQLite through the same interface expo-sqlite implements, so schema constraints, foreign keys and transactions are exercised for real.

## Known limitations

- Voice needs a development build or the APK (not Expo Go). Offline recognition depends on the phone's installed Google speech language pack.
- AI features need internet and your own API key (billed to your Anthropic account).
- Android is the target; iOS was not tested.
