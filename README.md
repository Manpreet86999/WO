# Body OS

Body OS is a private, local-first body system for PC. Workout and Skincare are sibling workspaces.

Version 3.0 adds shared validation and explainable calculation rules, active-set recovery, device sync conflict review, local diagnostics, and Android Health Connect/reminders. See [implementation and verification notes](docs/V3-IMPLEMENTATION.md) for setup and the remaining live-device checks.

- **PC edition:** React + Express + SQLite, bound only to `127.0.0.1`; includes program planning, reports, optional email, and optional server-side AI.

## Start on PC

### Windows installer (recommended)

1. Run `WorkoutOS-Setup.exe` (or `release\WorkoutOS-Setup.exe`).
2. Start **Workout OS** from the desktop shortcut.
3. Open [http://127.0.0.1:10000](http://127.0.0.1:10000).

Rebuild the installer after code changes:

```powershell
npm.cmd run build:installer
```

Your `data\` and `backups\` folders are preserved on upgrade.

### Push updates to friends (free via GitHub)

**Locked channel:** https://github.com/Manpreet86999/WO (hardcoded; Settings cannot change it)

1. Bump version in `package.json` and `src/shared/version.ts`.
2. `npm.cmd run build:installer`
3. Create a **GitHub Release** with tag `vX.Y.Z` and upload `WorkoutOS-Setup.exe`.

Friends open the app → terminal + dialog check for updates → install with dual data backup.  
Guides: [docs/GITHUB-UPDATES.md](docs/GITHUB-UPDATES.md) · [docs/DATA-SAFETY-UPDATES.md](docs/DATA-SAFETY-UPDATES.md).

### From source

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

Then open [http://127.0.0.1:10000](http://127.0.0.1:10000).

## Installable app

Body OS ships a PWA manifest and offline app shell. On `127.0.0.1`, supported browsers can install it from their browser’s **Install app** action. Training data and API responses are deliberately never cached by the service worker.

For installation on a phone, serve Body OS over HTTPS (or use a trusted local HTTPS reverse proxy); browsers do not permit service workers on ordinary `http://` LAN addresses.

Read the full [PC installation guide](pcguide.md).

## Data and privacy

- PC data: `data/powerpulse.db`; use Settings → Backup before updates.
- External AI and email remain opt-in PC features.

## Architecture & Code Sharing
Workout OS uses a **unified React frontend** injected with a Dependency Injected (DI) API client.
- `src/shared/`: Contains all domain models, type definitions, and business logic (like the local offline coach) so they run identically in Node.js and the browser.
- `src/client/`: The shared React UI. It fetches and mutates data against the abstract `WorkoutApiClient` interface.
- `src/server/`: The Express implementation of the API client, powered by a local SQLite database for the PC edition.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

V4 design and flashcard implementation status: [docs/V4-IMPLEMENTATION.md](docs/V4-IMPLEMENTATION.md).
Free local Android APK build guide: [docs/ANDROID-APK.md](docs/ANDROID-APK.md).
