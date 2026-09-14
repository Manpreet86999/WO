# Body OS 3.0 implementation and verification

This is a local development build. Nutrition was not added. No release, email, Telegram message, or live Firebase deployment was performed.

## Implemented

- Shared Zod schemas validate calendar dates, numeric inputs, workout sets, measurements, sync envelopes, health readings, and structured AI responses.
- Shared readiness excludes protein, hydration, and step targets from the score. It records the formula version and explains the inputs. With seven prior resting-heart-rate readings, it shows a personal median comparison without treating it as a validated recovery score. Historical records retain their original scores.
- A single progression implementation considers the full working-set prescription, RIR/RPE, repeated misses, equipment increments, and source session IDs. Missing sets or effort data prevent automatic load increases. Estimated one-rep max is suppressed beyond the supported 1–12 rep range.
- Desktop current-set drafts persist through refresh. Save failures are visible. Stable session IDs allow retries without creating another workout or resending a saved report.
- TanStack Query handles shared bootstrap/skincare loading and sync mutation status. The local database remains authoritative; Query is not used as a database or sync conflict resolver.
- Firebase transport reads all pages and uses Firestore update-time preconditions. Desktop sync compares local, cloud, and persisted base records, including tombstones. Settings presents conflicting versions before applying a choice. Mobile uses transactional SQLite records, a durable outbox, and conditional acknowledgements so edits made during sync remain pending. Tokens stay in SecureStore; a mobile database is bound to its first cloud account.
- Workout, skincare, and connected health records share the sync contract. Firebase rules separate read authorization from write validation.
- Pino writes bounded-at-startup local diagnostic logs to `data/diagnostics`. New diagnostic events include counts, duration, status and error type, without request bodies or credentials.
- Restore runs as a single transaction with nested savepoints. Backup verification also checks SQLite integrity. Fresh-install measurement columns and unstable default skincare records were corrected.
- Android has real working-set logging, resumable saved drafts, check-ins, plan/history views, manual sync with conflict choices, health imports, workout/skincare reminders, and rest alerts. Quiet hours move daily reminders or silence rest alerts.
- Health Connect reads permitted steps, sleep-session duration, and resting heart rate. It retains source IDs, intervals, units, and import timestamps, deduplicates repeats, and reconciles deleted readings inside fully covered successful import windows. Different sources are not added together. Overlapping or multi-day step intervals do not produce a daily total. Manual check-ins are not overwritten. Sleep-session duration is not labeled as actual time asleep.

## Verification

- `npm run typecheck` — desktop/server types.
- `npm test` — isolated data under a new `scratch/unit-*` folder, including restore rollback, sync merges/deletions, remote preconditions, pagination, validation, progression, and health/reminder edge cases.
- `npm run build` — desktop production bundle and server compilation.
- `npm run test:e2e` — isolated server/data on port 10091. Tests exercise actual set entry, reload recovery, finish/retry deduplication, the sync screen and measurement validation. On a machine with Chrome already installed, set `PLAYWRIGHT_CHANNEL=chrome`; otherwise run `npx playwright install chromium` first.
- In `apps/mobile`: `npm run typecheck`, `npx expo export --platform android`, and `npx expo prebuild --platform android --no-install`.
- `.github/workflows/verify.yml` runs the core checks, browser tests, mobile types, and Android JS bundle on pushes and pull requests.

## Live setup still required

1. Supply a Firebase project with Email/Password authentication and deploy `firebase/firestore.rules` to that specific project. No project ID or authenticated deployment target was supplied in this task. Enter the same project/account in desktop Settings and mobile More. Credentials are not embedded in the app.
2. Use a native Android build, not Expo Go, for Health Connect. The generated manifest includes read-only permissions for steps, sleep and resting heart rate, plus the permission-rationale intent handling. Minimum Android SDK is 26.
3. Build/run with an installed Android SDK and JDK, then verify permission grant/revocation, notification timing, app restart, airplane-mode logging, concurrent edits on two devices, and reconnect behavior. This workspace did not have an Android SDK/JDK or connected phone available for those checks. Native prebuild and JavaScript export are not APK compilation or device testing.
4. Configure a private release signing key before distributing an APK. Expo's generated development signing configuration is not a production signing setup. The Windows installer was not rebuilt or published as part of these source changes.

## Accuracy limits

The readiness and progression rules are explainable heuristics, not clinically validated measurements. The AI receives supplied calculated estimates and record references, and its JSON is structurally validated; this does not guarantee every free-text claim is correct. Health imports preserve provenance and make ambiguous totals unavailable instead of fabricating precision.
