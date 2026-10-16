# Building MindPulse AI in Android Studio

This guide builds the APK on your own PC with Android Studio and Gradle. It doesn't use EAS or an Expo account. (For the cloud build, see [BUILD_GUIDE.md](BUILD_GUIDE.md).)

This is an Expo project, so the `android/` folder is **generated** from `app.json`. Don't edit files inside `android/` by hand. Change `app.json`, then regenerate (step 5). `android/` is in `.gitignore`.

## What you need

- Android Studio (already installed). Its Android SDK is at `F:\Andriod_Studio`.
- **JDK 17** (installed at `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`). Android Studio's bundled JBR is Java 25, which is **too new**: Gradle 8.10 fails with `Unsupported class file major version 69`.
- Node.js 20 or newer.
- About 10 GB of free space for the NDK, CMake and Gradle caches. Gradle downloads these automatically on the first build.

## 1. Install JS dependencies

From the project root (`F:\Projects\Mindpulse_AI`):

```bash
npm ci
```

## 2. Generate the native Android project

```bash
npx expo prebuild --platform android
```

This creates `android/`. Then point Gradle at your SDK by creating `android/local.properties` with this line (use forward slashes):

```
sdk.dir=F:/Andriod_Studio
```

## 3. Open it in Android Studio

1. **File → Open** and select the **`android`** folder, not the project root.
2. **Before syncing**, go to **Settings → Build, Execution, Deployment → Build Tools → Gradle** and set **Gradle JDK** to the Temurin 17 entry (or **Add JDK…** and pick the Adoptium folder above). Don't leave it on the bundled JBR.
3. Click **Sync Project with Gradle Files** and wait. The first sync downloads Gradle, the NDK (26.1) and CMake.

## 4. Build

### Installable APK (release, JavaScript bundled in)

In Android Studio, open **Build → Generate App Bundles or APKs → Build APK(s)** after choosing the `release` variant in **Build Variants** (bottom-left panel). From a terminal (PowerShell) you can run this instead:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"; cd android; .\gradlew.bat assembleRelease
```

The output is `android/app/build/outputs/apk/release/app-release.apk`. Copy it to your phone and install it.

> The release build is signed with the **debug keystore** by default. That's fine for installing on your own devices, but the Play Store won't accept it. See "Signing for the Play Store" below.

### Debug build (live reload while developing)

1. Start Metro from the project root:
   ```bash
   npx expo start
   ```
2. In Android Studio, select the `debug` variant and press **Run ▶** with an emulator or a USB-connected phone (USB debugging on).

Or do both in one command: `npx expo run:android`.

A debug APK loads its JavaScript from Metro, so it won't work on its own without the dev server running.

## 5. After changing `app.json`, plugins or native packages

Regenerate `android/` so the changes take effect:

```bash
npx expo prebuild --platform android --clean
```

`--clean` deletes `android/` first, so recreate `android/local.properties` (step 2) afterwards. Then re-sync Gradle in Android Studio.

Changes to JS/TS only (`src/`, `App.tsx`) don't need a prebuild. Just rebuild.

## Signing for the Play Store (optional)

1. Create an upload key (keep this file and its passwords safe; never commit it):
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore mindpulse-upload.jks -alias mindpulse -keyalg RSA -keysize 2048 -validity 10000
   ```
2. In Android Studio, use **Build → Generate Signed App Bundle or APK** and select that keystore. Choose **Android App Bundle** for Play Store uploads.

Because `android/` is regenerated, set the keystore in that dialog each time rather than editing `android/app/build.gradle`.

## Troubleshooting

- **`Unsupported class file major version 69`**: Gradle is running on Java 25. Set Gradle JDK to 17 (step 3). From a terminal, set `JAVA_HOME` to the JDK 17 folder first.
- **"SDK location not found"**: `android/local.properties` is missing or uses backslashes. Use `sdk.dir=F:/Andriod_Studio`.
- **NDK/CMake download fails**: open **SDK Manager → SDK Tools**, tick **Show Package Details**, then install **NDK 26.1.10909125** and **CMake 3.22.1** by hand.
- **Build fails on long paths**: move the project to a shorter path, or enable Windows long paths.
- **APK is ~95 MB / build is slow**: it builds for 4 CPU types. For modern phones only, set `reactNativeArchitectures=arm64-v8a` in `android/gradle.properties` (gives a much smaller APK and faster build; re-apply after a `--clean` prebuild).
- **Out of memory**: raise `org.gradle.jvmargs` in `android/gradle.properties` (e.g. `-Xmx4096m`).
