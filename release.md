# Publish a Workout OS update to GitHub

This is the complete process from changing code to your friends installing the update.

## Before you start

- The update channel is locked to: `https://github.com/Manpreet86999/WO`
- The GitHub repository must be public so friends can download updates without signing in.
- The installer file must be named `WorkoutOS-Setup.exe`.
- A release must use a version **higher** than the version installed on your friends' PCs. Uploading a new file with the same version does not trigger an automatic update.

For example, if friends have `2.2.1`, publish `2.2.2`. If they already have `2.2.2`, publish `2.2.3` or `2.3.0`.

---

## 1. Make and test the code changes

Open PowerShell in the Workout OS project folder, then run:

```powershell
cd "E:\Workout OS"
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Fix any errors before creating an installer.

---

## 2. Set the release version

Change the version to the same number in all three places:

| File | Value to update |
|---|---|
| `package.json` | `"version": "X.Y.Z"` |
| `package-lock.json` | the two project version entries |
| `src/shared/version.ts` | `APP_VERSION = 'X.Y.Z'` |

Examples:

- Small fix: `2.2.2` → `2.2.3`
- New feature: `2.2.2` → `2.3.0`

Never publish a lower or matching version as an update. The app compares version numbers and will say it is already up to date.

---

## 3. Build the installer

Run:

```powershell
npm.cmd run build:installer
```

When it succeeds, upload this exact file:

```text
E:\Workout OS\WorkoutOS-Setup.exe
```

The same installer is also created at `E:\Workout OS\release\WorkoutOS-Setup.exe`.

---

## 4. Publish the GitHub Release

1. Open [GitHub Releases](https://github.com/Manpreet86999/WO/releases).
2. Click **Draft a new release**.
3. Create a new tag using the version from step 2, with `v` in front:
   - version `2.2.3` becomes tag **`v2.2.3`**
4. Set the release title, for example: **Workout OS 2.2.3**.
5. Add short release notes describing the changes.
6. Drag `WorkoutOS-Setup.exe` into the **Attach binaries** area.
7. Confirm the uploaded asset name is still `WorkoutOS-Setup.exe`.
8. Click **Publish release**.

Do not create a draft-only release: friends can only detect a published release.

---

## 5. What your friends do

1. They start Workout OS normally from the desktop shortcut.
2. The app checks the GitHub Releases page (updates can be cached for up to 15 minutes).
3. If the published version is higher, an **Update available** dialog appears.
4. They choose **Install update**.
5. Workout OS creates two verified safety backups, downloads the installer, installs it, and opens again.

Their workouts, database, settings, and backups stay on their PC. A friend who has never installed the updater version must run `WorkoutOS-Setup.exe` manually once; after that, GitHub Releases handle updates.

---

## Release checklist

- [ ] Code changes are complete
- [ ] `npm.cmd run typecheck` passes
- [ ] `npm.cmd test` passes
- [ ] Version increased in `package.json`, `package-lock.json`, and `src/shared/version.ts`
- [ ] `npm.cmd run build:installer` succeeds
- [ ] GitHub tag is `vX.Y.Z` and matches the app version
- [ ] `WorkoutOS-Setup.exe` is attached to the published release
- [ ] The tag is newer than the friends' installed version

## Common problems

| Problem | Fix |
|---|---|
| Friend sees “up to date” | Publish a version higher than the installed version; wait up to 15 minutes or use **Check for updates now** in Settings. |
| No update dialog | Make sure the GitHub release is published, not draft, and has `WorkoutOS-Setup.exe` attached. |
| Release asset is wrong | Edit the GitHub release, remove the incorrect asset, and upload the correct installer. |
| Friend has a very old app | Send them the latest `WorkoutOS-Setup.exe` and have them run it manually once. |
