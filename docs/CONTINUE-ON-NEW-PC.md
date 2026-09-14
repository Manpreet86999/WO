# Body OS — continuation on a new PC

This is a handoff summary, not the full Codex transcript. Updated 2026-09-09.

## User requirements
- User is nontechnical: give simple steps and do authorized implementation work directly.
- Every existing web feature must work in Android. This is non-negotiable. Full parity is NOT complete.
- Prioritize functionality and reliability before redesign. Later design should be premium, with left/right swipe cards for readiness/workout logging.
- No nutrition additions. Core app must remain usable free and offline. Avoid enabling paid cloud billing.
- Current priority: migrate from the old Windows PC, then run a development build on the physical realme RMX3381 (Android 13) with Fast Refresh, avoiding repeated APK transfers.

## Project
Old folder E:/Workout OS. Web: src/client; server: src/server; shared domain code: src/shared; Expo mobile: apps/mobile.
Node 24, Expo 57, React Native 0.86.3. Consult package.json and lockfiles for exact dependencies.
Read docs/MOBILE-PARITY.md and docs/MOBILE-API-INVENTORY.md. These are incomplete implementation ledgers, not acceptance reports. Check current source before changing it.
Do not assume Git contains all work: source was largely untracked during this task. Preserve local changes/data.

## Firebase
Project body-os-1b033; Android package com.bodyos.mobile.
Public config is in src/shared/firebase-config.ts and apps/mobile/google-services.json.
User confirmed Google provider enabled, Firestore created in Production mode, and release SHA-1 registered. Latest downloaded JSON includes matching Android and web OAuth clients.
Release SHA-1: E3:8D:42:68:FC:89:3C:44:AF:52:A3:7C:4D:C2:ED:9E:26:A8:2D:49.
Release keystore is separate from project: old location E:/BodyOS-Keys/body-os-release.keystore; alias bodyos. User must transfer it privately and retain the existing password. Never request password in chat or replace the key.
Confirm latest firebase/firestore.rules published and localhost/127.0.0.1 authorized. Don't recreate Firebase.
Web Google login was implemented and simplified (Settings > Device sync). CSP was fixed in src/server/app.ts to allow Google helper, Firebase frame and auth endpoints. Server restart is needed after header changes.
User subsequently reported syncing; read-only DB checks saw acknowledged cloud_bases grow from 344 to 371. Full first sync and phone round trip were NOT confirmed. First sync uploads the bundled 826-exercise catalog one record at a time, so it is slow.

## Implemented source and verification limits
Source includes Google login, foreground auto-sync, conflict handling/account binding, native plan/program/exercise editors, record forms, workout history, shared metrics/charts, local coaching, optional AI provider forms, PDF/CSV reports, mobile backup/atomic restore and Drive backup code.
Many advanced workflows remain incomplete: read the ledger. Drive/AI/native Google login and full offline/restart/upgrade flows need device testing. Mobile and desktop backup formats aren't yet fully interoperable.
49 unit tests passed before a later CSP regression test was added; the two server browser-policy tests passed afterward. Web/mobile typechecks and web/server builds passed. Android JS export passed (974 modules). None of these establishes full parity or a working development APK.

## Android Studio fixes and migration
1. Gradle daemon criteria had selected Java 25. Native prefab tooling failed on its restricted-access warning. Installed/tested JDK 17 fixed that configuration issue. Old generated android/gradle/gradle-daemon-jvm.properties was set to toolchainVersion=17. Old generated gradle.properties contains a PC-specific JDK path; do not reuse that old path on the new PC.
2. Expo generateStubPCH mishandled spaces in E:/Workout OS. Durable workaround: apps/mobile/scripts/patch-expo-pch.cjs, wired to mobile package.json postinstall. It parses quoted compiler arguments instead of splitting on spaces. npm ci should apply it automatically; it fails clearly if upstream code changes.
3. Exact verification command :expo-modules-core:generateStubPCH completed BUILD SUCCESSFUL in 4m 54s after patch; all four debug CMake architectures configured. Full development APK was NOT built/installed.
4. Separate old APK Gradle cache E:/Workout OS/.gradle-user-home had a lock owned by another process. Successful verification used C:/Users/Manpr/.gradle with JDK 17. Do not transfer caches or kill unrelated processes.
5. Existing release APK and standard debug APK use the same package but different keys. Do NOT uninstall the user's existing app to resolve that conflict. Plan a separate dev variant or user-controlled matching signing, preserving data. Debug Google login may need its own SHA-1/config registration.

## New PC setup
Use a folder without spaces, e.g. C:/BodyOS. Transfer source/scripts/config/lockfiles/docs, data and backups after closing the old server. Skip node_modules, apps/mobile/node_modules, generated apps/mobile/android, .expo, .gradle-user-home, scratch and dist. Transfer signing key separately. A Git clone alone may omit untracked code and local data.
Install Node 24, JDK 17, Android Studio and SDK 36/build-tools36/platform-tools/command-line tools. Reinstall root and mobile dependencies using npm ci; regenerate Android via Expo prebuild. Select JDK 17 and check daemon criteria again. Keep the PCH postinstall patch.
Build-Android-APK.cmd contains hardcoded old E: paths, username and JDK path. Adapt it to the new machine before use. Also inspect any other scripts for machine paths.
First next action: inspect the new environment and copied project, preserve user data/signing identity, then finish the development-phone workflow. Do not call the entire task complete based on successful compilation.

## Latest native design work — 9 September 2026
The latest Stitch reference is in design/stitch-import-v2. Source now includes Onboarding.tsx, FeatureMenu.tsx and SetEntry.tsx, five main tabs, Google-only account entry, swipe logging, the charcoal/lime theme and automatic rest countdown after a saved set. Read docs/MOBILE-DESIGN-IMPLEMENTATION.md for exact validation and remaining work. This has not passed real-phone acceptance or complete web parity; preserve the existing release key and local records.

