# Mobile feature parity implementation ledger

Priority: working equivalents of every existing web feature before visual redesign. No nutrition additions. Core storage and workflows remain local. Firebase Spark is the proposed optional sync service; Google Drive backups are separate from record sync.

Completion requires functional actions and device verification, not a screen placeholder or a sync entity alone.

| Area | Required scope | Status |
|---|---|---|
| Identity | Google sign-in on web/Android, account linking, existing-data migration, isolation | Google sign-in implemented; refreshed Android OAuth config matches release certificate. Live login, linking and migration unverified |
| Sync | Automatic retry, incremental transfers, concurrent edit/delete protection, account isolation | Foreground auto-sync, retries and account binding implemented; incremental transfer and live round-trip testing remain |
| Readiness | Inputs, optional HR/notes, explicit pain response, history, edit, same scoring | Partial |
| Workout | All set modes/types, prescriptions, substitutions, warm-ups, supersets, timers, editing, resume | In progress |
| Plans | Full week/day prescription editor, duplicate, import/export, start day | Partial |
| Library | Bundled catalog, search/filter, custom CRUD, favourites, collections, substitutions | Catalog, search, custom CRUD and favourites implemented; collections/substitutions incomplete |
| Programs/calendar | Multiweek plans, phases, scheduling, reschedule/missed actions | Program editor and scheduling implemented; calendar action parity incomplete |
| Records | Session details, edit/delete, cardio, habits | Partial |
| Analysis | PRs, e1RM, volume, trends, readiness, comparison, lift history | Shared metrics and trend charts implemented; full comparison/lift-history parity unverified |
| Goals/body | Goal/check-in CRUD, measurements, pain logs | Forms implemented; goal calculations tested; device verification pending |
| Reports | Existing reports/exports, configured delivery integrations | Local PDF and workout CSV implemented; delivery integrations incomplete |
| Coaching | Existing training/skin guidance and configured providers | Shared local coach and optional provider requests implemented; advanced workflow parity incomplete |
| Skincare | Profile, product CRUD, routine editing, logging/history/trends | Profile/product CRUD, routine runner with timers, routine-only completion, check-ins and journal charts implemented; real-device verification remains |
| Settings | Profile/units/training, appearance, protection, notifications, help | Partial |
| Recovery | Local export/restore, Drive backup, migration/upgrade | Native reviewed restore with safety backup, JSON/CSV export and Drive source implemented; desktop format interoperability and live/upgrade tests pending |

## Verification gates

- For each feature: create, read, edit, delete and import/export where present on web.
- Offline save, restart, retry and duplicate-tap checks.
- Same records and calculations after web-to-phone and phone-to-web exchanges.
- Simultaneous edits/deletions, token expiry and account switching.
- Upgrade the installed APK with the existing signing identity without losing records.
- Live Firebase/Google sign-in and real-phone checks must be marked unverified until performed.

## External setup

Firebase project: `body-os-1b033`. User confirms Google Authentication enabled, Firestore created in Production mode, and release SHA-1 registered. Refreshed Android configuration now includes the matching Android OAuth client and web client ID. Latest Firestore rules publication and web authorized domains remain unverified. No live sign-in or sync test has passed yet. No passwords, signing-key secrets or service-account private keys should be sent in chat.
