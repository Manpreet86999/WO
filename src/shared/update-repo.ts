/**
 * PERMANENT update channel — do not make this user-editable.
 * All friends' installs check this public GitHub repo for Releases.
 *
 * Developer workflow:
 * 1. npm run build:installer
 * 2. Create a GitHub Release on this repo (tag e.g. v2.2.1)
 * 3. Upload WorkoutOS-Setup.exe as a release asset
 */
export const PERMANENT_GITHUB_REPO = 'Manpreet86999/WO';

export const PERMANENT_GITHUB_URL = `https://github.com/${PERMANENT_GITHUB_REPO}`;

export const PERMANENT_RELEASES_URL = `https://github.com/${PERMANENT_GITHUB_REPO}/releases`;

/** Normalize owner/repo or full GitHub URL → owner/repo */
export function toOwnerRepo(input: string): string {
  return String(input || '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
}
