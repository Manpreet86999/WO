# Body OS Mobile

## Run locally

```powershell
cd apps/mobile
npm install
npx expo start --android
```

Health Connect needs a native Android build. Use `npm run android` with an Android SDK/JDK installed; it does not work in Expo Go. Read [the v3 implementation notes](../../docs/V3-IMPLEMENTATION.md) before distributing builds.

The app includes local set logging and draft recovery, daily recovery check-ins, plan/history views, manual device sync with conflict review, Health Connect imports under Progress, and reminder controls under More. Notification permission is requested when enabling reminders or a rest alert, not at startup.

Verification: `npm run typecheck`, `npx expo export --platform android`, and `npx expo prebuild --platform android --no-install`. These do not replace testing a native build on a phone.

## Firebase setup

1. Create a Firebase project and enable **Email/Password** in Authentication.
2. Create a Firestore database, then deploy the repository rules from `firebase/firestore.rules` using the Firebase CLI.
3. In Body OS Mobile → **More**, enter the Firebase Web API key and Project ID, then sign in with the same account used on desktop.

The API key identifies the Firebase project; it is not an authentication secret. Passwords, AI keys, email credentials, OAuth refresh tokens, and Telegram tokens are never sent to Firestore.

## APK

Run `npm run apk` after installing Android Studio and configuring a release signing key. The output APK is for direct tester installation; it is not a Play Store package.
