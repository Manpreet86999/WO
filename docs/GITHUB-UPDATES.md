# Workout OS updates (permanent GitHub channel)

## Locked repository

```
https://github.com/Manpreet86999/WO
```

Hardcoded in `src/shared/update-repo.ts` as `PERMANENT_GITHUB_REPO`.  
**Friends cannot change this** in Settings. Every install checks the same place.

---

## How it works (Play Store style)

| Step | What happens |
|------|----------------|
| You ship | `npm run build:installer` → upload the single `BodyOS-Setup.exe` file to the **Release** |
| Friend starts app | Terminal logs `[update] Checking…` |
| Browser opens | Dialog: **Update available** → Install / Not now |
| Install | Download percentage → dual safety backup → silent install → embedded requirements verification → missing packages installed → local server restarts |

Data safety details: [DATA-SAFETY-UPDATES.md](./DATA-SAFETY-UPDATES.md)

---

## Developer: publish an update

1. Bump version in **both**:
   - `package.json`
   - `src/shared/version.ts` (`APP_VERSION`)
2. `npm.cmd run build:installer` (the installer embeds its own `requirements.txt` and verifier)
3. GitHub → **Releases** → **Draft a new release**
   - Tag: `v2.2.1` (must be **newer** than friends’ installed version)
   - Upload one asset: **`BodyOS-Setup.exe`**
   - Publish

Friends open the app → dialog → see the real download percentage → Install. After the server restarts, Body OS opens a one-time “what’s new” dialog using the release notes.

---

## Public repo: is there a risk?

### What is public
- Release files you upload (`WorkoutOS-Setup.exe`)
- Release notes / tags
- Any **source code** you put in the repo (if you push code)

### What is NOT public (never uploaded by the updater)
- Friends’ workouts, PIN, SQLite DB, email passwords, AI keys  
  Those stay on **each PC only** (`data\powerpulse.db`)

### Risks of a public repo
| Risk | Reality |
|------|---------|
| People download your installer | Intended — free distribution |
| People see your source | Only if you push source; you can keep repo **empty of code** and only use **Releases** |
| People reverse-engineer the app | Possible with any desktop app / public installer |
| Workout data leaked | **No** — data never goes to GitHub |

**Recommendation:** Keep this public repo as an **update channel** (releases only). Keep private training data off GitHub.

---

## Can we use a private repo instead?

**Yes, but it’s harder for free friend installs.**

| | Public (current) | Private |
|--|------------------|---------|
| Friends check updates | Free, no login | Needs a **GitHub token** with `contents:read` / release access |
| Token in the app | Not needed | Anyone who has the app can extract the token |
| Cost | Free | Free for private repos on GitHub Free, but sharing access is messy |
| Best for | Friend group + Play-Store-like UX | Closed company apps with signed secure updates |

**If you want private later:** add a server-only env token `GITHUB_TOKEN` that is **not** shipped to friends, and host the check on a small free API you control — more work. For friends today, **public Releases is the right free design**.

---

## First-time: create the first release

If the repo is empty:

1. Open https://github.com/Manpreet86999/WO/releases/new  
2. Tag `v2.2.1` (match current `APP_VERSION`)  
3. Upload current `WorkoutOS-Setup.exe`  
4. Publish  

Until a release exists, the app reports “no releases yet” and stays on the installed version.
