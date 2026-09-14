# Body OS 4.0 — implementation status

This is a local development build, not a published release. Nutrition is excluded. No required paid dependency or service was added. The broader V4 roadmap remains a roadmap; the scope verified here is the design, logging, and local Android build preparation described below.

## Implemented

- Shared desktop visual refresh: sage/graphite surfaces, larger typography, spacious cards, clearer focus states, responsive controls, and refreshed navigation labels. Both existing desktop themes are supported.
- Readiness flashcards: one question at a time, numeric/rating answers, left swipe to advance, right swipe to go back, keyboard and button navigation, validation, final review, and explicit save. A dated local draft survives reloads.
- Desktop workout flashcards: one set per card, previous-set context, persistent entries, back/next and horizontal swipes. Timed/repetition modes and advanced set fields remain available. Swiping never saves or finishes a workout.
- Pointer capture and horizontal thresholds distinguish card navigation from vertical scrolling; input controls do not initiate desktop swipes. Reduced-motion preferences suppress the desktop entrance animation.
- Explicit local-only workout completion bypasses report generation and Telegram sending. The optional report action remains separate. Existing API callers retain their previous report behavior.
- Weekly focus prompts can be dismissed. Training no longer requires completing earlier weekdays in order.
- Android design refresh with focused readiness/workout cards, progress indicators, swipes, accessible buttons, saved current-entry/check-in drafts, a set review, undo of the last newly logged set, and confirmation before finishing.
- Android plans can be created locally without Firebase, using a simple exercise list and an explicit default 3 × 8 prescription. Existing plans can start a linked workout and supply movement choices. This is not a full native visual program editor.
- Android skincare routines and daily observations can be viewed and saved locally. Numeric skin observations are required rather than fabricated. Skin hydration is not nutrition tracking.
- Optional Firebase sync is labeled as optional. No automatic billing configuration, paid API, or cloud build service was added. The native app uses a dark palette in this iteration.
- App source/package metadata is 4.5.0, Android versionCode 4. Historical readiness/progression calculations retain their 3.0 formula version because the formulas did not change. Old installer artifacts were not relabeled as V4.
- Repeatable local APK script and Expo release-signing plugin; release builds require private signing credentials. Instructions are in ANDROID-APK.md. No signing secrets were created or embedded.

## Verification

- Desktop/client and server TypeScript checks; server compilation.
- Android TypeScript check and JavaScript export.
- 38 existing automated tests covering calculations, validation, restore, and sync.
- 3 browser tests: readiness validation and both swipe directions, draft recovery, no save before confirmation, 390px layout, multiple workout-set cards, reload recovery, one saved session after retry, and measurement validation.
- Expo Android native generation; inspected release signing configuration and version metadata.

Browser coverage does not replace native device testing. The existing large desktop bundle warning remains.

## Still required before a production release

- Install/configure an Android SDK and JDK, compile the signed APK, and verify gestures, keyboard interaction, rest notifications, permissions, offline recovery, and upgrades on a real phone. No APK was produced on this machine.
- Rebuild and test the Windows installer, including distribution contents and upgrade/restore behavior.
- Finish broader roadmap features separately: full native timed/assisted/superset workflow, stable-ID/unit migration across all historical analytics, automatic reconnect/account-switch sync, Health Connect Changes API, coaching proposal/undo evaluations, full native accessibility/device testing, and performance budgets.
- Firebase deployment is only needed if optional cloud sync is wanted. Keep it on Spark without billing; quota exhaustion must not stop local logging. Local Wi-Fi sync is not implemented.

No live Firebase deployment, outgoing message, signed release, or public publication was performed during this work.
