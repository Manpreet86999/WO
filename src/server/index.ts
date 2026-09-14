import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { BACKUP_DIR, DATA_DIR, HOST, PORT, SQLITE_FILE } from './config.js';
import { createApp } from './app.js';
import { getDb, closeDb } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { startCronJobs } from './services/cron.js';
import { initMcp } from './ai/mcp.js';
import { checkForUpdates, runStartupDataRecovery } from './services/updates.js';
import { APP_VERSION } from '../shared/version.js';
import { PERMANENT_GITHUB_REPO, PERMANENT_RELEASES_URL } from '../shared/update-repo.js';

function openDesktopAppWindow() {
  if (process.env.BODY_OS_OPEN_APP !== '1') return;

  const url = `http://127.0.0.1:${PORT}`;
  const launch = (command: string, args: string[]) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  };

  if (process.platform === 'win32') {
    const edgeCandidates = [
      process.env['ProgramFiles(x86)'] && `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
      process.env.ProgramFiles && `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ].filter((path): path is string => Boolean(path));
    const edge = edgeCandidates.find((path) => fs.existsSync(path));

    if (edge) {
      console.log(`  [launcher] Opening Body OS in its own app window: ${url}`);
      launch(edge, [`--app=${url}`]);
      return;
    }

    console.log(`  [launcher] Opening Body OS in your default browser: ${url}`);
    launch('cmd.exe', ['/c', 'start', '', url]);
    return;
  }

  console.log(`  [launcher] Opening Body OS: ${url}`);
  launch(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // If an update (or anything else) wiped/missing the DB, restore from SafetyVault first.
  const recovery = runStartupDataRecovery();
  if (recovery.recovered) {
    console.log(`  [data-guard] ${recovery.message}`);
  } else if (recovery.message && !recovery.message.includes('Data OK')) {
    console.warn(`  [data-guard] ${recovery.message}`);
  }

  const db = getDb();
  migrate(db);

  const app = createApp();
  
  // Initialize MCP servers in background
  initMcp().catch(console.error);

  const server = app.listen(PORT, HOST, () => {
    console.log('');
    console.log(`  Body OS ${APP_VERSION} (local single-user)`);
    console.log(`  URL:  http://127.0.0.1:${PORT}`);
    console.log(`  DB:   ${SQLITE_FILE}`);
    console.log(`  Bind: ${HOST} only (not exposed on LAN)`);
    console.log(`  Updates: github.com/${PERMANENT_GITHUB_REPO} (locked channel)`);
    console.log('  Keep this terminal open. Press Ctrl+C to stop.');
    console.log('');

    openDesktopAppWindow();

    // Terminal update check on every start (like Play Store — check, UI asks to install)
    void (async () => {
      try {
        console.log('  [update] Checking for updates…');
        const u = await checkForUpdates({ force: true });
        if (u.updateAvailable && u.latestVersion) {
          console.log(`  [update] ★ UPDATE AVAILABLE: v${u.latestVersion} (you have v${u.currentVersion})`);
          console.log('  [update] Open the app in the browser — a dialog will ask to install.');
          console.log(`  [update] Release: ${u.htmlUrl || PERMANENT_RELEASES_URL}`);
          console.log('  [update] Your workouts are dual-backed-up before any install.');
        } else {
          console.log(`  [update] Up to date (v${u.currentVersion}). ${u.message || ''}`);
        }
      } catch (e) {
        console.warn(`  [update] Check failed (offline?): ${(e as Error).message}`);
      }
    })();
    
    startCronJobs();
  });

  const shutdown = () => {
    console.log('\nShutting down…');
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
