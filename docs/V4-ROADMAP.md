# Body OS 4.0 roadmap

Status: V4 design and card-flow implementation is in development. See V4-IMPLEMENTATION.md for verified scope and remaining work. Nutrition is excluded. No required paid services.

## Product objective

Make Body OS dependable for daily training, recovery tracking, body progress, and skincare across Windows and Android. Build on the shared validation, calculations, drafts, sync, and health imports implemented in 3.0.

## Delivery order

### 0. Close the 3.0 release gaps

- Optional only: configure a Firebase Spark project and test/deploy its access rules if cloud sync is wanted. Do not attach billing; local use must work independently.
- Compile and test a native Android build on a real phone, including permissions, notifications, offline use, and restart recovery.
- Produce signed Android and Windows packages with explicit packaging allowlists and consistent version metadata.
- Validate upgrades, backup restoration, and rollback with representative existing data.

Exit: installation and upgrade work on supported devices; account isolation and backup recovery pass. A JavaScript export or native prebuild alone does not satisfy this gate.

### 1. Complete the everyday workflow

- Today screen: planned workout, check-in, next skincare routine, recent progress, and sync status.
- Start an Android workout directly from its plan; support substitutions, supersets, timed sets, bodyweight/assisted exercises, rest timers, and edit/undo.
- Persist the currently typed mobile set, not only sets already added to the draft.
- Add native AM/PM skincare routines and completion logging using the existing synced entities.
- Review onboarding and make weekly goal prompts dismissible. Any change to activation policy remains a product decision.

Exit: a complete planned workout and skincare routine can be logged offline; interruption/restart preserves entries; retrying completion creates one session.

### 2. Improve data accuracy

- Use stable exercise IDs with aliases and explicit migration from name-based matching.
- Record load units and exercise load semantics per set; distinguish external weight, bodyweight, and assistance.
- Preserve measurement units, source timestamps, provenance, and calculation versions.
- Show missing, stale, measured, and estimated data distinctly. Explain coverage rather than inventing confidence percentages.
- Compare like-for-like sessions and make historical formula changes explicit.

Exit: unit preference changes never reinterpret historical loads; renamed exercises preserve history; missing values never silently become zero; comparable-session fixtures verify progression and records.

### 3. Make synchronization routine

- Sync on reconnect and foreground resume with retry backoff and a visible pending/error state.
- Present conflicts as readable field differences and preserve both versions until resolved.
- Introduce isolated account storage and deliberate sign-out/account switching.
- Hide developer Firebase configuration from normal sign-in flows.
- Upgrade Health Connect imports to incremental Changes API synchronization, including deletion handling, expired-token recovery, and permission changes.
- Add source preferences and clear freshness labels. Background reads are optional and depend on OS support and user permission.

Exit: two-device edits, deletes, interrupted requests, token expiry, and account changes pass integration tests without lost or duplicated records. Background execution is never represented as guaranteed real-time sync.

### 4. Deliver explainable coaching and progress

- Weekly review covering training consistency, comparable strength trends, recovery input coverage, body measurements, and skincare adherence.
- Preview suggested plan changes with supporting sessions, assumptions, and an explicit apply/undo flow.
- Keep numerical recommendations in the tested rules engine; use AI for explanation and constrain it to supplied evidence.
- Add evaluations for missing/stale records, contradictory inputs, unsupported claims, and unsafe progression suggestions.
- Add skincare product-change timelines and reported reactions without claiming causation or diagnosis.

Exit: every numerical suggestion traces to stored inputs and a formula version; insufficient evidence produces an explicit limitation; plan changes are reversible.

### 5. Release quality

- Expand browser and native workflow tests, Firebase emulator rules tests, migration fixtures, and restore drills.
- Add continuous log rotation, opt-in redacted diagnostic export, accessibility checks, and measured startup/bundle budgets.
- Run internal alpha, limited device beta, then stable release after all previous gates pass.

Exit: no unresolved data-loss, account-isolation, migration, or workout-completion defects; real device results and release artifacts are recorded.

## Technology decisions

- Retain React, Expo/React Native, Express, SQLite, Firebase, Zod, TanStack Query, Pino, and Playwright.
- Add Firebase Emulator Suite for account/rules/integration testing.
- Evaluate Maestro for native Android end-to-end workflows; select it after a small device proof of concept.
- Add signed release CI and dependency/artifact checks once the build and signing environment is available.
- Use Health Connect Changes API for incremental ingestion. Official guidance: https://developer.android.com/health-and-fitness/health-connect/sync-data
- Defer additional wearable vendor APIs until a concrete unsupported data need exists. Defer camera form scoring, autonomous AI plan edits, social features, and a backend rewrite.

## Scope and dependencies

Core 4.0 includes phases 0–5. Optional integrations are not release requirements. Reliable time estimates require the native build environment, target device list, Firebase project, and acceptance of this scope. Implementation should proceed in the order above; interface prototypes may be explored earlier, but release gates should not be skipped.
