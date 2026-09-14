# Build the Body OS 4 Android APK for free

No Firebase project, Expo cloud build subscription, or Play Store account is needed for this local build. The APK stores records in SQLite on your phone and bundles the JavaScript; your PC and Metro do not need to run after installation. Online integrations remain optional.

## 1. Install the local build tools

Install Node.js 24 LTS, Android Studio, and JDK 17 (the React Native recommended baseline). In Android Studio SDK Manager install Android SDK Platform 36, Android SDK Build-Tools, Platform-Tools, Command-line Tools, and the NDK version requested by this project's Gradle build. Accept SDK licenses. Gradle may download additional matching components during the first build.

Set Windows environment variables to your actual installation directories:

- `JAVA_HOME`: your JDK folder, containing `bin/java.exe`.
- `ANDROID_HOME`: your Android SDK folder, commonly `C:\Users\YOUR_NAME\AppData\Local\Android\Sdk`.

Open a new PowerShell window after setting these. Use the versions requested by the generated Gradle project if Android Studio reports a mismatch; do not randomly upgrade Gradle independently of Expo.

## 2. Install project dependencies

```powershell
Set-Location 'E:\Workout OS\apps\mobile'
npm ci
```

If this PC's npm shortcut reports a missing `npm-cli.js`, the working installation found during development was:

```powershell
node E:\node\node_modules\npm\bin\npm-cli.js ci
```

## 3. Create your private signing key once

Choose a private directory outside this repository. In PowerShell run the following, substituting a real full path:

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -storetype PKCS12 -keystore 'C:\YOUR_PRIVATE_DIRECTORY\body-os-release.keystore' -alias bodyos -keyalg RSA -keysize 2048 -validity 10000
```

The tool prompts for your password and certificate details. Keep an offline backup of the key and password. Future updates must use the same key. Do not commit them or paste them into chat.

Create/edit `%USERPROFILE%\.gradle\gradle.properties` locally, preserving existing properties, and add these four values (replace the placeholders; use forward slashes in the file path):

```properties
BODYOS_RELEASE_STORE_FILE=C:/YOUR_PRIVATE_DIRECTORY/body-os-release.keystore
BODYOS_RELEASE_STORE_PASSWORD=YOUR_PRIVATE_PASSWORD
BODYOS_RELEASE_KEY_ALIAS=bodyos
BODYOS_RELEASE_KEY_PASSWORD=YOUR_PRIVATE_PASSWORD
```

The release-signing Expo plugin reads these properties and refuses a release build when required credentials are absent. Expo regeneration preserves this setup through the plugin; do not manually change release signing to the debug key.

## 4. Build the installable APK

```powershell
Set-Location 'E:\Workout OS\apps\mobile'
node scripts/build-apk.cjs
```

This generates the native project and runs `:app:assembleRelease` locally. The first build needs internet to download development dependencies. This is an APK build, not an AAB intended for store upload.

Successful output:

`E:\Workout OS\apps\mobile\android\app\build\outputs\apk\release\app-release.apk`

## 5. Install and test

Copy the APK to your Android phone, open it, and allow installation from that source when Android asks. Alternatively, with USB debugging enabled and the phone authorized, run:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r 'E:\Workout OS\apps\mobile\android\app\build\outputs\apk\release\app-release.apk'
```

Confirm swipe left/next and swipe right/back; verify vertical scrolling and keyboard entry; log in airplane mode; restart during a draft; finish once and inspect history; check skincare and notification permissions. Health Connect needs a compatible device and granted read permissions; the rest of the app should work without them.

For updates, increment `expo.android.versionCode` in `app.json`, rebuild using the same signing key, and install over the old app. A prior debug-signed installation cannot be updated with a different release key. Export/back up its records before considering any uninstall: uninstalling removes local app data.

## Current verification boundary

The Android SDK and a Java 17 toolchain are now installed. The first signed build reached native configuration but failed while using Android Studio's Java 25. The double-click launcher now selects the installed Java 17 toolchain. A successful signed APK and phone test are still pending. Type checking, JavaScript export, and native generation are separate checks and do not prove native runtime behavior. Public app distribution has requirements separate from this personal local build.

Official references:

- https://docs.expo.dev/guides/local-app-production/
- https://reactnative.dev/docs/set-up-your-environment
- https://reactnative.dev/docs/signed-apk-android


## This PC: Java compatibility fix

Use `Build-Android-APK.cmd` in the repository root. It selects Java 17 at `C:\Users\Manpr\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2` and SDK `E:\Android`, then asks for the existing signing-key password privately. The launcher sets production mode for Expo. If building inside Android Studio instead, choose this Java 17 directory under Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK.

The Java 17 verification attempt also encountered a full C drive. The launcher now places Gradle downloads/cache in `E:\Workout OS\.gradle-user-home` and temporary files in `E:\Workout OS\scratch\android-temp`. The Java 17 installation and signing key remain in their original locations. No personal files were deleted; signed-build verification is still pending.
