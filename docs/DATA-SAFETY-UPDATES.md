# Data safety plan for Workout OS updates

**Goal:** Users must not lose workouts, history, or settings when updating — even if something goes wrong mid-install.

---

## Threats we protect against

| Risk | Mitigation |
|------|------------|
| Installer overwrites / deletes `data\` | Installer never packages DB; dirs flagged `uninsneveruninstall`; no InstallDelete on data |
| User picks a wrong folder | Auto-update always uses current install `ROOT` |
| Full install folder deleted by mistake | **Second copy** in `%LOCALAPPDATA%\WorkoutOS\SafetyVault` (outside app) |
| DB locked / half-written during copy | WAL checkpoint + close DB + dual verify (size + SHA-256) |
| Backup fails silently then install runs | **Hard gate:** install never starts if backup fails |
| DB missing after install | Guard script + startup recovery auto-restore from vault |
| User clicks update by accident | Permission modal; clear “Not now” |

---

## Required sequence (automatic)

```
User clicks Install
    ↓
Download Setup.exe from GitHub
    ↓
createPreUpdateSafetyBackup()
  • JSON full export
  • SQLite file copy (after checkpoint)
  • Write to  backups\pre-update-…\
  • Write to  %LOCALAPPDATA%\WorkoutOS\SafetyVault\…
  • Verify size + sha256 on BOTH copies
    ↓
If backup OK → spawn safe-update.bat
If backup FAIL → STOP (no install, data untouched)
    ↓
Stop server → run Inno /VERYSILENT into same DIR
    ↓
If data\powerpulse.db missing/tiny → copy from vault
    ↓
Start app → startup recovery double-checks DB
```

---

## Where backups live

1. **In-app:** `{install}\backups\pre-update-{timestamp}-v{version}\`
   - `powerpulse.db` (+ wal/shm if any)
   - `workout-os-full-backup.json`
   - `manifest.json`
2. **External vault (survives wipe of install folder):**
   - `%LOCALAPPDATA%\WorkoutOS\SafetyVault\…`
   - `LATEST.json` pointer

Log: `{install}\backups\last-update-log.txt`

---

## Manual recovery (if everything fails)

1. Open `%LOCALAPPDATA%\WorkoutOS\SafetyVault`
2. Open the newest `pre-update-…` folder
3. Either:
   - Copy `powerpulse.db` into `{install}\data\`, **or**
   - Settings → Data → Restore Backup using `workout-os-full-backup.json`

---

## Developer rules when shipping updates

1. Never put real `data/*.db` into the installer stage.
2. Never add `{app}\data` to `[UninstallDelete]` / `[InstallDelete]`.
3. Keep dual backup gate in `applyDownloadedUpdate`.
4. Test once: install update on a machine with known sessions and confirm counts match.

---

## What “cannot lose data” means in practice

We cannot stop a user from manually deleting their vault and install folder.
We **do** guarantee for normal auto-update:

- No install without verified dual backup
- Installer does not target user data files
- Automatic restore if DB disappears after setup
- External vault independent of the app directory
