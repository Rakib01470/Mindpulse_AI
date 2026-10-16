# Building the MindPulse AI APK

This guide builds an installable Android APK with **EAS Build**, Expo's cloud build service. Your laptop doesn't compile anything: it uploads the project, and Expo's servers build the APK and give you a download link.

The commands run in **WSL Ubuntu**, not Windows PowerShell. Windows Smart App Control blocks some unsigned native binaries that `npm install` downloads; WSL avoids that.

Time: about 20 minutes of setup the first time, plus queue and build time on Expo's side (often 10–30 minutes on the free plan).

---

## 1. One-time setup

### 1a. Create a free Expo account
Sign up at **https://expo.dev/signup** and confirm your email. Remember the username and password; the terminal will ask for them.

### 1b. Install Node.js 20 in WSL
Open **Ubuntu** from the Start menu and check what you have:

```bash
node -v
```

If it prints `v20.x` or newer, skip to step 2. Otherwise install Node 20 with nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
node -v        # should print v20.x
```

### 1c. Tell git who you are (EAS uses git to pick which files to upload)

```bash
git config --global user.name "Md. Rakib Hasan"
git config --global user.email "you@example.com"
```

---

## 2. Copy the project into WSL

`npm install` is very slow (and sometimes fails) on Windows drives mounted in WSL (`/mnt/f/...`). Work on a copy inside your WSL home folder. `F:\Projects\Mindpulse_AI` stays the master copy.

```bash
mkdir -p ~/mindpulse-app
rsync -a --exclude node_modules /mnt/f/Projects/Mindpulse_AI/ ~/mindpulse-app/
cd ~/mindpulse-app
git config core.fileMode false   # stops git treating Windows file permissions as changes
npm ci                           # installs the exact versions I tested with
```

`npm ci` takes a few minutes. Warnings about "deprecated" or "vulnerabilities" are normal; only a line that starts with `npm ERR!` is a real failure.

---

## 3. Build the APK

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

Answer the prompts like this:

| Prompt | Answer |
|---|---|
| Would you like to automatically create an EAS project for @yourname/mindpulse-ai? | **Y** |
| Generate a new Android Keystore? | **Y** (Expo stores it for you; future builds reuse it) |
| Detected uncommitted changes / commit them? (if asked) | **Y** |

The terminal then uploads the project and prints a **build details link** (`https://expo.dev/accounts/.../builds/...`). You can close the terminal at this point, because the build runs on Expo's servers. Watch progress at that link or at **expo.dev → Projects → mindpulse-ai → Builds**.

**After the first build only:** EAS wrote your project ID into `app.json`. Copy it back to the master folder so future builds stay linked to the same project:

```bash
cp ~/mindpulse-app/app.json /mnt/f/Projects/Mindpulse_AI/app.json
```

---

## 4. Install on your phone

1. When the build shows **Finished**, open the build page on your phone (log in to expo.dev, or scan the QR code on the build page from your laptop screen).
2. Tap **Install** / **Download** to get the `.apk`.
3. Open the downloaded file. If Android asks, allow **Install unknown apps** for your browser or Files app.
4. If Play Protect warns that the app is unrecognised, choose **More details → Install anyway**. That's expected for sideloaded apps.

---

## 5. First run checklist

1. **Settings → AI API Key**: paste an Anthropic key (`sk-ant-...`) or a free Google Gemini key (`AIza...`, from https://aistudio.google.com/apikey) → **Save Key** → **Test API Key**. You should see the green "Valid Key".
2. **Dashboard → mic button** → allow microphone → say *"High priority office task submit monthly branch compliance report by Friday 5 PM"* → check the card → **Save Task**.
3. Turn on **Airplane mode** and dictate another task. You should see the "Network unavailable…" banner, and the task is saved with your words as the title.
4. **Tasks**: drag a slider to 100%. The task should be struck through.
5. **Projects → New Project** "3D Asset Dev", 50 hrs → **Start Session** → switch to Notes. The timer should keep counting at the bottom → come back → stop it → check the session log.
6. **Notes**: write a sloppy sentence under topic "Web Novel" → **Fix Grammar & Format** → **Accept Changes**.
7. **Settings → Export Data** → save to Drive or Files → delete a task → **Import Data** → choose the file → **Overwrite**. The task should come back.

If a step misbehaves, note what you did and what you saw (a screenshot helps) and send it to me.

---

## 6. Rebuilding after changes

Edit files in `F:\Projects\Mindpulse_AI`, then in Ubuntu:

```bash
rsync -a --exclude node_modules /mnt/f/Projects/Mindpulse_AI/ ~/mindpulse-app/
cd ~/mindpulse-app
npm ci                      # only needed if package.json changed
npx eas-cli@latest build -p android --profile preview
```

Install the new APK over the old one. Your data stays, because Expo reuses the same signing key.

---

## 7. Optional: a development build (faster iteration)

If you plan to change the code often, build a **development client** once:

```bash
npx eas-cli@latest build -p android --profile development
```

Install that APK. After that, most code changes don't need a rebuild: run `npx expo start --tunnel` in `~/mindpulse-app` and open the project from the dev-client app on your phone. Use `--tunnel` because your phone can't reach WSL directly over Wi-Fi. If it asks to install `@expo/ngrok`, say yes.

You only need to rebuild the development APK when you add a package with native code or change `app.json` plugins or permissions.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm ci` fails with network or timeout errors | Run it again. Mobile-data or ISP hiccups are the usual cause. |
| `eas: command not found` | Use `npx eas-cli@latest ...` exactly as written, not `eas ...`. |
| Build fails on Expo's servers | Open the build page, expand the red step (usually *Run gradlew*), copy the last ~40 lines and send them to me. |
| "Voice recognition is not available in this build" | You're in Expo Go. Install the APK from this guide instead. |
| Mic works but nothing is recognised offline | Install the offline English pack: Android Settings → *Google* → *Voice* (or *Speech*) → *Offline speech recognition*. |
| "Invalid Key" in Settings | Re-copy the key with no spaces: Anthropic keys from console.anthropic.com (check the account has credit), Gemini keys from aistudio.google.com/apikey. |
| "AI limit reached" | Gemini's free tier allows a limited number of requests per minute. Wait a minute and try again. |

---

## Check a Gemini key before building (optional)

Run this in Ubuntu, replacing `YOUR_KEY` with your key. It sends one tiny request to the same model the app uses:

```
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent" -H "x-goog-api-key: YOUR_KEY" -H "Content-Type: application/json" -d '{"contents":[{"role":"user","parts":[{"text":"Reply with OK"}]}]}'
```

- A reply containing `"text": "OK"` means the key and model both work.
- `API key not valid` means the key is wrong.
- `models/... is not found` means Google renamed the model. Change `GEMINI_MODEL` in `src/utils/constants.ts` to a current Flash-Lite model from https://ai.google.dev/gemini-api/docs/models.
