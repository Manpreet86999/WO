/** Durable AI report delivery. A workout is always saved first; delivery may be retried safely. */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../config.js';
import * as repo from '../db/repository.js';
import { generateSessionReport } from '../ai/engine.js';
import { generateReportEmailPayload, sendMail } from './email.js';

export type PendingReport = { sessionId: string; createdAt: string; attempts: number; lastError: string };
const queueFile = path.join(DATA_DIR, 'pending-ai-reports.json');

function readQueue(): PendingReport[] {
  try { const value = JSON.parse(fs.readFileSync(queueFile, 'utf8')); return Array.isArray(value) ? value : []; } catch { return []; }
}
function writeQueue(items: PendingReport[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(queueFile, JSON.stringify(items, null, 2));
}
function queue(sessionId: string, error: string) {
  const items = readQueue();
  const existing = items.find((item) => item.sessionId === sessionId);
  if (existing) { existing.attempts += 1; existing.lastError = error; }
  else items.push({ sessionId, createdAt: new Date().toISOString(), attempts: 1, lastError: error });
  writeQueue(items);
}
function remove(sessionId: string) { writeQueue(readQueue().filter((item) => item.sessionId !== sessionId)); }
export function pendingReports() { return readQueue(); }

export async function deliverSessionAiReport(sessionId: string): Promise<{ ok: true; sentTo: string[] } | { ok: false; queued: true; error: string }> {
  const data = repo.loadAppDb();
  const settings = repo.getSettings();
  const session = repo.getSession(sessionId);
  try {
    if (!session) throw new Error('Saved workout could not be found.');
    if (!settings.senderEmail || !settings.appPassword || !settings.recipients?.length) throw new Error('Email sender, Gmail App Password, and at least one recipient are required.');
    if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) throw new Error('AI is not connected. Reports are sent only after AI analysis succeeds.');
    const ai = await generateSessionReport(data, settings, session);
    if (!ai.ok || !ai.report?.overallSummary?.trim()) throw new Error(ai.error || 'AI returned an empty report. Check the provider, key, and model.');
    session.aiOverallSummary = ai.report.overallSummary.trim();
    for (const log of session.logs) if (log.status === 'completed' && ai.report.exerciseComments[log.name]) log.aiCoachComment = ai.report.exerciseComments[log.name];
    repo.saveSession(session);
    const payload = await generateReportEmailPayload(session);
    await sendMail(settings, {
      to: settings.recipients,
      subject: `Body OS AI report · ${session.name || 'Athlete'} · ${session.date}`,
      html: payload.html,
      attachments: payload.attachments,
    });
    remove(sessionId);
    return { ok: true, sentTo: settings.recipients };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Report delivery failed.';
    queue(sessionId, message);
    return { ok: false, queued: true, error: message };
  }
}

export async function retryPendingReports() {
  const queued = readQueue();
  const results = [] as Array<{ sessionId: string; ok: boolean; error?: string }>;
  for (const item of queued) { const result = await deliverSessionAiReport(item.sessionId); results.push({ sessionId: item.sessionId, ok: result.ok, error: result.ok ? undefined : result.error }); }
  return results;
}
