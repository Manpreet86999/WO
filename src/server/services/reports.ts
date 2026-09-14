import * as repo from '../db/repository.js';
import type { Session, Week } from '../../shared/types.js';
import { computeMetrics } from './metrics.js';
import { reportHtml } from './email.js';
import { escapeHtml } from '../lib/ids.js';

export async function generateDailyReportHtml(sessionId: string): Promise<Buffer> {
  const db = repo.loadAppDb();
  const session = db.sessions.find(s => s.id === sessionId);
  if (!session) throw new Error('Session not found');
  const html = reportHtml(session);
  return Buffer.from(html, 'utf8');
}

export async function generateWeeklyReportHtml(weekId: string): Promise<Buffer> {
  const db = repo.loadAppDb();
  const week = db.weeks.find(w => w.id === weekId);
  if (!week) throw new Error('Week not found');
  const html = `<!DOCTYPE html>
<html class="dark" lang="en"><head><meta charset="utf-8"/><title>Weekly Report</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body class="bg-[#081425] text-white p-8 font-sans max-w-3xl mx-auto">
<h1 class="text-4xl font-bold text-[#c3f400]">Weekly Report: ${escapeHtml(week.name)}</h1>
<p class="mt-4 text-gray-300">Generated on ${new Date().toLocaleDateString()}</p>
<img src="https://lh3.googleusercontent.com/aida-public/AB6AXuClrbjc16eakVS5GG_UHKHeCD1ip1Fcoyv07TVMpfzgV_fsCo7zNFKly90EH3MhnycaJ27vPPoSnoSnrOAq04gOgWGjvzGNjssvwSiXMb5OygsqGKB2S20xLTD4gcSKZs73ryVrzHh4UtzXYCCoFUaMIUgtFzCk-kmEdG-hqc6_TGw_hJZRbddI2j3fvMOx6ubjtIV3D_Z2UzhoSo1tDSht2qVkm2bPjTf7Zeqnye1fypKXPnQKZfRAbHW0F8QqbAfChQ" class="w-12 h-12 mt-8 opacity-70" />
</body></html>`;
  return Buffer.from(html, 'utf8');
}

export async function generateProgressReportHtml(fromDate?: string, toDate?: string): Promise<Buffer> {
  const html = `<!DOCTYPE html>
<html class="dark" lang="en"><head><meta charset="utf-8"/><title>Progress Report</title>
<script src="https://cdn.tailwindcss.com"></script>
</head><body class="bg-[#081425] text-white p-8 font-sans max-w-3xl mx-auto">
<h1 class="text-4xl font-bold text-[#c3f400]">Progress Report</h1>
<p class="mt-4 text-gray-300">${escapeHtml(fromDate || 'All time')} to ${escapeHtml(toDate || 'Latest')}</p>
<p class="mt-4 text-gray-300">Generated on ${new Date().toLocaleDateString()}</p>
<img src="https://lh3.googleusercontent.com/aida-public/AB6AXuClrbjc16eakVS5GG_UHKHeCD1ip1Fcoyv07TVMpfzgV_fsCo7zNFKly90EH3MhnycaJ27vPPoSnoSnrOAq04gOgWGjvzGNjssvwSiXMb5OygsqGKB2S20xLTD4gcSKZs73ryVrzHh4UtzXYCCoFUaMIUgtFzCk-kmEdG-hqc6_TGw_hJZRbddI2j3fvMOx6ubjtIV3D_Z2UzhoSo1tDSht2qVkm2bPjTf7Zeqnye1fypKXPnQKZfRAbHW0F8QqbAfChQ" class="w-12 h-12 mt-8 opacity-70" />
</body></html>`;
  return Buffer.from(html, 'utf8');
}
