# Body OS V4 web platform foundation

The web app is the detailed Body OS workspace. Training and Care use one Google account, one owner-scoped Firestore record collection, one portable backup contract, and one conflict policy. Nutrition is not part of this platform.

## Record contract

Each portable record has an ID, owner-scoped Firestore location, workspace, entity type, revision, creation and update times, source device, deletion time when archived, payload version, and its feature payload. `src/shared/platform.ts`, `src/shared/sync.ts`, and `src/shared/record-repository.ts` are the extension boundary for future workspaces.

Training owns training, readiness, plans, sessions, body, goals and reports. Care owns skin profile, products, routines and journal entries. Core owns account, backup, sync, device status, and health imports. A new workspace must register its routes and record types through this shared layer; it must not add another login, database, or backup format.

## Web account and sync behavior

The normal web workspace requires Google sign-in. Firebase configuration is part of the build and is not requested from people using Body OS. The first Google session shows a record-count review before it merges any legacy local data. Later saves in Training or Care mark sync pending; a central service performs a short, debounced sync when online. A conflict pauses transfer and requires a choice.

The local desktop database remains the offline cache and compatibility bridge while the existing analysis routes move to the owner-scoped repository. It is not an additional account system. The next migration step is replacing those server read/write routes with Firestore-backed repository calls while retaining the same record contract.

## Backup contract

Google Drive uses its private `appDataFolder`, rather than a visible Drive folder. The backup payload is `body-os-portable-backup` version 1 and contains safe records only. It excludes email, Telegram, AI, OAuth, signing, and other desktop secrets. Restore creates a local safety backup before applying data.

## Firebase deployment requirement

The Firestore rules in `firebase/firestore.rules` are the required owner boundary. Before public use, deploy these rules to the `body-os-1b033` Firebase project and test two different Google accounts. The repository does not contain Firebase administrator credentials, so deployment is intentionally performed by the project owner.

## Extension checklist

1. Add a workspace definition and route registration.
2. Define versioned payloads and map record types to that workspace.
3. Use `OwnerScopedRecordRepository`; do not create another login or data store.
4. Add portable-backup validation and migration tests.
5. Register only the permissions and optional integrations the workspace actually uses.
