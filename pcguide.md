# Workout OS — PC installation

Workout OS PC is the private desktop edition. It runs only on `127.0.0.1`, keeps its SQLite database on your computer, and can optionally use email reports and an AI coach.

## Requirements

- Windows, macOS, or Linux
- [Node.js LTS 20 or later](https://nodejs.org/)
- Internet access only for the first dependency installation and optional email/AI features

## Install and start

1. Copy or clone the complete Workout OS folder to the computer.
2. Open a terminal in that folder.
3. Install dependencies and build the interface:

   ```powershell
   npm.cmd install
   npm.cmd run build
   ```

   On macOS/Linux, use `npm` instead of `npm.cmd`. If PowerShell blocks `npm.ps1`, always use `npm.cmd` as shown above.

4. Start the local application:

   ```powershell
   npm.cmd start
   ```

5. Open [http://127.0.0.1:10000](http://127.0.0.1:10000) in the same computer’s browser. Keep the terminal open while using Workout OS; press `Ctrl+C` to stop it.

`python setup.py` followed by `python run.py`, or `start.bat` on Windows, remain supported shortcuts.

## First-time activation

On first launch, Workout OS requires four steps before the training screens unlock:

1. Create your local profile.
2. Enter a Gmail address and Gmail App Password, then verify the six-digit code sent to that address.
3. Request your unique eight-word developer activation key.
4. Paste the key to activate, then complete the required in-app feature guide.

Keep the activation key private. If an email code expires, use **Resend code** in the setup wizard. Google Drive backup is optional and is configured only after activation in **Settings → Data**.

## Fresh install privacy

`WorkoutOS-Setup.exe` does **not** include another person's workouts, database, backups, email password, API keys, Google tokens, PIN, activation key, or profile. On a new PC it creates a fresh local database and opens the required setup wizard.

When installing over an existing Workout OS installation, the installer deliberately keeps that PC's own `data/` and `backups/` folders so that user's history is not lost.

## Your data and backup

- The desktop database is `data/powerpulse.db`.
- Use **Settings → Backup → Export Backup** before updating the app or moving computers.
- To restore a phone export, transfer the JSON file to the PC and use **Settings → Backup → Restore Backup**.
- Copying the whole project folder including `data/` and `backups/` is the safest migration to a new PC.
- **Settings → Data → Backup Health** shows local export options and Google Drive status. Google Drive retains the five newest cloud backups.
- Before restoring from Google Drive, Workout OS creates a verified local safety backup. If a restore is not what you expected, use that local copy to recover.

## Updates and troubleshooting

1. Export a backup.
2. Replace the application files, keeping `data/` and `backups/`.
3. Run `npm.cmd install` and `npm.cmd run build` again.

If the page does not open, confirm that port 10000 is free and visit `/api/health`. If the build fails, run `npm.cmd run typecheck`; do not delete `data/powerpulse.db` unless you intentionally want to erase local history.

## Privacy

The desktop server is bound to localhost only; it is not reachable from other devices or the internet. A PIN protects local access but is not full-database encryption. Email and AI are optional: only use them if you accept that the selected provider receives the request you send.
