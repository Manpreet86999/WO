import { canonical } from '../../shared/cloud.js';
import { runDesktopSync } from '../services/sync-engine.js';
import { sessionInputSchema, measurementInputSchema } from '../../shared/schemas.js';
import { Router } from 'express';
import crypto from 'node:crypto';
import { HOST, PORT } from '../config.js';
import * as repo from '../db/repository.js';
import { id, recipients, escapeHtml } from '../lib/ids.js';
import { hashPin } from '../lib/secrets.js';
import {
  authMiddleware,
  createSessionToken,
  revokeSession,
  tryUnlock,
} from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  benchmarkFreeModels,
  listFreeModels,
  runAiAsk,
  runSessionBrief,
  testAiConnection,
  runMorningBrief,
  runWorkoutGen,
  runPlateauBuster,
  runExerciseCues,
  runAutoRegulate,
  generateSessionReport,
  runSkinAsk,
  runSkinLogReview,
  runSkinBuildRoutine,
} from '../ai/engine.js';
import { DEFAULT_OPENROUTER_MODEL } from '../ai/models.js';
import { reportHtml, sendMail, welcomeEmailHtml, generateReportEmailPayload, emailDeliveryMessage } from '../services/email.js';
import { computeMetrics } from '../services/metrics.js';
import { buildProgression } from '../services/progression.js';
import { normalizeReadiness, readinessModifier } from '../services/readiness.js';
import { unwrapBackup } from '../../shared/domain.js';
import { aiCoach, localCoach } from '../services/coach.js';
import * as queue from '../services/queue.js';
import * as telegram from '../services/telegram.js';
import * as pdf from '../services/reports.js';
import * as googleFit from '../services/googleFit.js';
import * as reportDelivery from '../services/report-delivery.js';
import type { AppDb, FlexibleDayState, PlannedExercise, Session, Week } from '../../shared/types.js';
import { SKIN_PRODUCT_TEMPLATE } from '../../shared/skin.js';
import {
  bestSetE1rm,
  buildDeloadWeekDays,
  logTonnage,
  sessionsToCsv,
  workSets,
} from '../../shared/training.js';
import {
  applyDownloadedUpdate,
  acknowledgeUpdateNotice,
  beginUpdateDownload,
  checkForUpdates,
  getAppVersion,
  getUpdateDownloadStatus,
  getUpdateNotice,
} from '../services/updates.js';
import * as gdrive from '../services/gdrive-backup.js';
import { createPreUpdateSafetyBackup } from '../services/safe-backup.js';
import { programmingRouter } from './programming.js';
import { firebaseSessionFromToken, firebaseSignIn, previewCloudSync, pushFirebaseRecords } from '../services/cloud-sync.js';
import { syncRecordsFromDb } from '../../shared/sync.js';
import { snapshotFromRecords } from '../../shared/record-snapshot.js';
import { duckDbStatus, rebuildAnalyticsMirror } from '../services/duckdb-analytics.js';
import * as knowledge from '../services/knowledge.js';
import { doclingStatus } from '../services/docling.js';

export const apiRouter = Router();

// Local cache for OTPs. Acceptable because this is a single-process local desktop app.
let otpCache: { code: string; expiresAt: number } | null = null;
const DEVELOPER_FEEDBACK_EMAIL = 'manpreet86999singh@gmail.com';

apiRouter.use(authMiddleware);

apiRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    port: PORT,
    host: HOST,
    mode: 'local-single-user',
    urls: [`http://127.0.0.1:${PORT}`],
  });
});

apiRouter.get('/analytics-lab/status', async (_req, res, next) => {
  try { res.json(await duckDbStatus()); } catch (error) { next(error); }
});

apiRouter.post('/analytics-lab/rebuild', async (_req, res, next) => {
  try { res.json(await rebuildAnalyticsMirror(repo.loadAppDb())); } catch (error) { next(error); }
});

apiRouter.get('/knowledge/documents', (_req, res) => res.json({ documents: knowledge.listKnowledgeDocuments() }));
apiRouter.get('/knowledge/docling-status', (_req, res) => res.json(doclingStatus()));
apiRouter.get('/knowledge/search', (req, res) => res.json({ hits: knowledge.searchKnowledge(String(req.query.q || ''), Number(req.query.limit || 6)) }));
apiRouter.post('/knowledge/documents', (req, res, next) => { try { res.status(201).json(knowledge.addKnowledgeDocument(req.body || {})); } catch (error) { next(error); } });
apiRouter.delete('/knowledge/documents/:id', (req, res) => { knowledge.removeKnowledgeDocument(req.params.id); res.json({ ok: true }); });

apiRouter.get('/auth/status', (_req, res) => {
  const s = repo.publicSettings();
  res.json({ hasPin: s.hasPin, unlocked: !s.hasPin });
});

apiRouter.post(
  '/auth/unlock',
  rateLimit({ windowMs: 60_000, max: 10 }),
  (req, res) => {
    const pin = String(req.body?.pin || '');
    const result = tryUnlock(pin);
    if (!result.ok) return res.status(401).json({ error: result.error });
    res.json({ ok: true, token: result.token });
  },
);

apiRouter.post(
  '/auth/setup-pin',
  rateLimit({ windowMs: 60_000, max: 5 }),
  (req, res) => {
    const pin = String(req.body?.pin || '');
    const currentPin = String(req.body?.currentPin || '');
    if (!/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4—8 digits.' });
    }
    const settings = repo.getSettings();
    if (settings.pinHash) {
      const check = tryUnlock(currentPin);
      if (!check.ok) return res.status(401).json({ error: 'Current PIN is incorrect.' });
    }
    const { hash, salt } = hashPin(pin);
    repo.saveSettings({ pinHash: hash, secretsSalt: salt });
    const token = createSessionToken();
    res.json({ ok: true, token, settings: repo.publicSettings() });
  },
);

apiRouter.get('/queue/pending', (_req, res) => {
  res.json(queue.getPendingTasks());
});

apiRouter.post('/queue/skip-session', (req, res) => {
  const { weekId, dayKey, date } = req.body;
  if (!weekId || !dayKey) return res.status(400).json({ error: 'Missing params' });
  
  const week = repo.getWeek(weekId);
  repo.saveSession({
    id: id('sess'),
    weekId,
    weekName: week?.name || '',
    weekNumber: week?.weekNumber || 0,
    dayKey,
    dayTitle: week?.days.find(d => d.key === dayKey)?.title || '',
    date: date || new Date().toISOString().split('T')[0],
    status: 'skipped',
    name: 'Skipped Session',
    createdAt: new Date().toISOString(),
    logs: [],
  } as unknown as Session);
  res.json({ ok: true });
});

apiRouter.post('/telegram/test', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  const chatId = await telegram.getUpdatesToFindChatId(token);
  if (chatId) {
    res.json({ chatId });
  } else {
    res.json({ ok: true });
  }
});

apiRouter.post('/telegram/send-report', async (req, res) => {
  const { weekId } = req.body;
  if (!weekId) return res.status(400).json({ error: 'weekId required' });
  try {
    const buffer = await pdf.generateWeeklyReportHtml(weekId);
    await telegram.sendTelegramDocument(`weekly-report-${weekId}.html`, buffer, `Here is your weekly report!`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

apiRouter.post('/auth/clear-pin', (req, res) => {
  const pin = String(req.body?.pin || '');
  const settings = repo.getSettings();
  if (!settings.pinHash) return res.json({ ok: true, settings: repo.publicSettings() });
  const check = tryUnlock(pin);
  if (!check.ok) return res.status(401).json({ error: 'PIN is incorrect.' });
  repo.saveSettings({ pinHash: '', secretsSalt: '' });
  revokeSession(check.token);
  res.json({ ok: true, settings: repo.publicSettings() });
});

apiRouter.post('/settings/reset', (req, res) => {
  repo.resetDataKeepSettings();
  res.json({ ok: true });
});

apiRouter.post('/settings/hard-reset/request', async (req, res) => {
  try {
    const settings = repo.getSettings();
    if (!settings.senderEmail || !settings.appPassword) {
      return res.status(400).json({ error: 'Email sender is not configured in Settings. Cannot send OTP.' });
    }
    const code = crypto.randomInt(100000, 999999).toString();
    otpCache = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
    await sendMail(settings, {
      to: [settings.senderEmail],
      subject: 'Body OS: Hard Reset OTP',
      html: `<p>You requested a hard reset. Your OTP is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

apiRouter.post('/settings/hard-reset/confirm', (req, res) => {
  const { otp } = req.body;
  if (!otpCache || otpCache.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'OTP expired or not requested.' });
  }
  if (otpCache.code !== otp) {
    return res.status(400).json({ error: 'Invalid OTP.' });
  }
  otpCache = null; // consume OTP
  repo.hardResetWipeEverything();
  res.json({ ok: true });
});

apiRouter.post('/setup/verify-email-request', async (req, res) => {
  const { senderEmail, appPassword } = req.body;
  if (!senderEmail || !appPassword) return res.status(400).json({ error: 'Missing email or password' });
  
  try {
    const code = crypto.randomInt(100000, 999999).toString();
    otpCache = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
    const tempSettings = { ...repo.getSettings(), senderEmail, appPassword };
    await sendMail(tempSettings, {
      to: [senderEmail],
      subject: 'Body OS: Email Verification OTP',
      html: `<p>Your email verification OTP is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify email credentials.' });
  }
});

apiRouter.post('/setup/verify-email-confirm', (req, res) => {
  const { otp } = req.body;
  if (!otpCache || otpCache.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'OTP expired or not requested.' });
  }
  if (otpCache.code !== otp) {
    return res.status(400).json({ error: 'Invalid OTP.' });
  }
  otpCache = null;
  res.json({ ok: true });
});

apiRouter.post('/setup/generate-product-key', async (req, res) => {
  const { senderEmail, appPassword } = req.body;
  if (!senderEmail || !appPassword) return res.status(400).json({ error: 'Missing email or password' });
  
  try {
    const productKey = Array.from({ length: 4 }, () => crypto.randomInt(1000, 10_000).toString()).join('-');
    const productKeyHash = crypto.createHash('sha256').update(productKey.replace(/\D/g, '')).digest('hex');
    
    // Save settings temporarily with the hash
    const tempSettings = { ...repo.getSettings(), senderEmail, appPassword, productKeyHash };
    repo.saveSettings(tempSettings);
    
    // Email developer
    await sendMail(tempSettings, {
      to: ['manpreet86999singh@gmail.com'],
      subject: 'Body OS: 16-digit Product Key',
      html: `<p>A new user (${escapeHtml(senderEmail)}) is requesting activation.</p><p>The 16-digit product key is: <strong>${escapeHtml(productKey)}</strong></p>`
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate product key. Ensure app password is correct.' });
  }
});

// A developer-issued key lets non-technical users activate Body OS before
// connecting optional email, Drive, Telegram, or AI services.
const DEVELOPER_PRODUCT_KEY_HASH = 'ef231f2b0b6e212989377653571ffc67887a9c00aceec5069de7c816107b73c4';

apiRouter.post('/setup/activate-product-key', async (req, res) => {
  const { productKey } = req.body;
  if (!productKey) return res.status(400).json({ error: 'Missing product key' });
  
  const settings = repo.getSettings();
  const normalized = String(productKey).replace(/\D/g, '');
  if (!/^\d{16}$/.test(normalized)) return res.status(400).json({ error: 'Enter a valid 16-digit product key.' });
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  const isDeveloperKey = hash === DEVELOPER_PRODUCT_KEY_HASH;
  const isInstallationKey = Boolean(settings.productKeyHash) && hash === settings.productKeyHash;
  if (!isDeveloperKey && !isInstallationKey) {
    return res.status(400).json({ error: 'Invalid key' });
  }
  
  // Set activated
  repo.saveSettings({ isActivated: true });
  
  // Send welcome email to user
  try {
    await sendMail(settings, {
      to: [settings.senderEmail],
      subject: 'Body OS: Activation Successful',
      html: welcomeEmailHtml(repo.getProfile().displayName || 'Athlete')
    });
  } catch (err) {
    console.error('[api] Welcome email failed', err);
  }
  
  res.json({ ok: true });
});

apiRouter.get('/bootstrap', (_req, res) => {
  const data = repo.loadAppDb();
  const appSettings = repo.getSettings();
  const analytics = computeMetrics(data, appSettings);
  const coach = localCoach(data, appSettings);
  const todayReady = data.readiness.find((r) => r.date === new Date().toISOString().slice(0, 10));
  const programming = todayReady
    ? readinessModifier(todayReady.score, Boolean(todayReady.painFlag))
    : null;
  res.json({
    db: data,
    skin: repo.loadSkinState(),
    settings: repo.publicSettings(),
    analytics,
    coach,
    programming,
    urls: { local: `http://127.0.0.1:${PORT}`, network: [] as string[] },
  });
});

/** —— AI engine —— */
apiRouter.get('/ai/models', (_req, res) => {
  res.json(listFreeModels());
});

apiRouter.post(
  '/ai/test',
  rateLimit({ windowMs: 60_000, max: 8 }),
  async (_req, res, next) => {
    try {
      const result = await testAiConnection(repo.getSettings());
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/benchmark',
  rateLimit({ windowMs: 120_000, max: 2 }),
  async (req, res, next) => {
    try {
      const s = repo.getSettings();
      if (!s.aiApiKey || s.aiProvider !== 'openrouter') {
        return res.status(400).json({
          error: 'OpenRouter API key required. Save key in Settings (provider: OpenRouter).',
        });
      }
      const limit = Math.min(8, Math.max(2, Number(req.body?.limit) || 5));
      const result = await benchmarkFreeModels(s.aiApiKey, limit);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/coach',
  rateLimit({ windowMs: 60_000, max: 12 }),
  async (_req, res, next) => {
    try {
      const data = repo.loadAppDb();
      const coach = await aiCoach(data, repo.getSettings());
      res.json({ coach });
    } catch (e) {
      next(e);
    }
  },
);

/** Legacy alias */
apiRouter.post('/ai-coach', async (_req, res, next) => {
  try {
    const data = repo.loadAppDb();
    const coach = await aiCoach(data, repo.getSettings());
    res.json({ coach });
  } catch (e) {
    next(e);
  }
});

apiRouter.post(
  '/ai/ask',
  rateLimit({ windowMs: 60_000, max: 15 }),
  async (req, res, next) => {
    try {
      const result = await runAiAsk(repo.loadAppDb(), repo.getSettings(), String(req.body?.question || ''));
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/session-brief',
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (req, res, next) => {
    try {
      const sessionId = String(req.body?.sessionId || '');
      const session = sessionId ? repo.getSession(sessionId) : (req.body?.session as Session | undefined);
      if (!session) return res.status(404).json({ error: 'Session not found.' });
      const result = await runSessionBrief(repo.loadAppDb(), repo.getSettings(), session);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/morning-brief',
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (_req, res, next) => {
    try {
      const result = await runMorningBrief(repo.loadAppDb(), repo.getSettings());
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/workout-gen',
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (req, res, next) => {
    try {
      const prompt = String(req.body?.prompt || '');
      const result = await runWorkoutGen(repo.getSettings(), prompt);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/plateau-buster',
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (req, res, next) => {
    try {
      const exercise = String(req.body?.exercise || '');
      const result = await runPlateauBuster(repo.loadAppDb(), repo.getSettings(), exercise);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/exercise-cues',
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (req, res, next) => {
    try {
      const exercise = String(req.body?.exercise || '');
      const result = await runExerciseCues(repo.getSettings(), exercise);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/auto-regulate',
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (req, res, next) => {
    try {
      const sessionJson = String(req.body?.sessionJson || '');
      const result = await runAutoRegulate(repo.loadAppDb(), repo.getSettings(), sessionJson);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.get('/heatmap/data', (req, res) => {
  const data = repo.loadAppDb();
  // Get sessions from the last 14 days
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentSessions = data.sessions.filter(s => s.status === 'finished' && s.date >= twoWeeksAgo);
  
  const muscleFatigue: Record<string, number> = {};
  for (const s of recentSessions) {
    for (const log of s.logs || []) {
      if (log.status !== 'completed' || !log.sets?.length) continue;
      const target = (log.target || 'Other').toLowerCase();
      
      // Calculate a rough "volume load" score
      let score = 0;
      for (const set of log.sets) {
        const w = Number(set.w) || 0;
        const r = Number(set.r) || 0;
        score += w > 0 ? w * r : r * 10; // fall back to reps*10 if bodyweight
      }
      
      // Decay older sessions (very simple)
      const daysOld = Math.floor((Date.now() - new Date(s.date).getTime()) / (1000 * 3600 * 24));
      const decay = Math.max(0.1, 1 - (daysOld / 14));
      
      if (!muscleFatigue[target]) muscleFatigue[target] = 0;
      muscleFatigue[target] += (score * decay);
    }
  }

  // Normalize scores 0 to 1
  let maxScore = 0;
  for (const val of Object.values(muscleFatigue)) if (val > maxScore) maxScore = val;
  
  const normalized: Record<string, number> = {};
  if (maxScore > 0) {
    for (const [key, val] of Object.entries(muscleFatigue)) {
      normalized[key] = val / maxScore;
    }
  }

  res.json(normalized);
});

apiRouter.use(programmingRouter);

apiRouter.post('/readiness', (req, res) => {
  const normalized = normalizeReadiness(req.body || {}, repo.listReadiness());
  if (normalized.error || !normalized.item) {
    return res.status(400).json({ error: normalized.error || 'Invalid readiness' });
  }
  const existing = repo.listReadiness().find((r) => r.date === normalized.item!.date && r.weekId === normalized.item!.weekId && r.dayKey === normalized.item!.dayKey);
  if (existing?.createdAt) normalized.item!.createdAt = existing.createdAt;
  const item = repo.saveReadiness(normalized.item);
  const data = repo.loadAppDb();
  const appSettings = repo.getSettings();
  res.json({
    readiness: item,
    analytics: computeMetrics(data, appSettings),
    coach: localCoach(data, appSettings),
    programming: readinessModifier(item.score, item.painFlag),
  });
});

const FLEX_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function isoToday() { return new Date().toISOString().slice(0, 10); }
function addCalendarDays(date: string, count: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + count); return d.toISOString().slice(0, 10); }
function mondayFor(date: string) { const d = new Date(`${date}T12:00:00`); const shift = (d.getDay() + 6) % 7; d.setDate(d.getDate() - shift); return d.toISOString().slice(0, 10); }
function flexibleWeekFor(data: AppDb, date = isoToday()) {
  return data.weeks.find((week) => week.mode === 'flexible' && week.status === 'draft' && week.flexibleStartDate && week.flexibleEndDate && week.flexibleStartDate <= date && week.flexibleEndDate >= date);
}
function priorFlexibleDaysDone(week: Week, dayKey: string) {
  const target = FLEX_DAYS.indexOf(dayKey);
  return FLEX_DAYS.slice(0, Math.max(0, target)).every((key) => {
    const state = week.dayStates?.[key]?.status;
    return state === 'workout' || state === 'rest' || state === 'not_in_week';
  });
}

apiRouter.post('/flexible-weeks/start', (req, res) => {
  const strategy = String(req.body?.strategy || 'today');
  if (!['today', 'monday', 'next-monday'].includes(strategy)) return res.status(400).json({ error: 'Choose today, this Monday, or next Monday.' });
  const data = repo.loadAppDb();
  const current = flexibleWeekFor(data);
  if (current) return res.json({ week: current, resumed: true });
  const today = isoToday();
  const currentMonday = mondayFor(today);
  const startDate = strategy === 'today' ? today : strategy === 'monday' ? currentMonday : addCalendarDays(currentMonday, 7);
  const startIndex = strategy === 'today' ? FLEX_DAYS.indexOf(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${today}T12:00:00`).getDay()]) : 0;
  const dayStates = Object.fromEntries(FLEX_DAYS.map((key, index) => [key, {
    status: index < startIndex ? 'not_in_week' : index === startIndex ? 'ready' : 'locked',
    date: addCalendarDays(currentMonday, index),
  }])) as Record<string, FlexibleDayState>;
  const week: Week = {
    id: id('flex-week'), name: 'Flexible training week', weekNumber: '', startDate: currentMonday, notes: '', active: false, status: 'draft', mode: 'flexible',
    flexibleStartDate: startDate, flexibleEndDate: addCalendarDays(currentMonday, 6), flexibleFirstDayKey: FLEX_DAYS[startIndex], dayStates,
    days: FLEX_DAYS.map((key) => ({ key, type: 'flexible', title: 'Flexible workout', subtitle: 'Choose your focus for today.', muscles: [], exercises: [] })),
  };
  repo.upsertWeek(week);
  res.json({ week });
});

apiRouter.post('/flexible-weeks/:weekId/rest', (req, res) => {
  const week = repo.getWeek(req.params.weekId);
  const dayKey = String(req.body?.dayKey || '');
  if (!week || week.mode !== 'flexible' || week.status !== 'draft') return res.status(404).json({ error: 'Flexible week not found.' });
  if (!FLEX_DAYS.includes(dayKey) || !priorFlexibleDaysDone(week, dayKey)) return res.status(400).json({ error: 'Complete earlier days before recording rest.' });
  const current = week.dayStates?.[dayKey];
  if (!current || current.status === 'locked' || current.status === 'not_in_week') return res.status(400).json({ error: 'This day is not available yet.' });
  const nextKey = FLEX_DAYS[FLEX_DAYS.indexOf(dayKey) + 1];
  const dayStates: Record<string, FlexibleDayState> = { ...(week.dayStates || {}), [dayKey]: { ...current, status: 'rest', completedAt: new Date().toISOString() } };
  if (nextKey && dayStates[nextKey]?.status === 'locked') dayStates[nextKey] = { ...dayStates[nextKey], status: 'ready' };
  repo.upsertWeek({ ...week, dayStates });
  res.json({ ok: true });
});

apiRouter.post('/flexible-weeks/:weekId/complete', (req, res) => {
  const data = repo.loadAppDb();
  const week = data.weeks.find((item) => item.id === req.params.weekId);
  const name = String(req.body?.name || '').trim();
  if (!week || week.mode !== 'flexible') return res.status(404).json({ error: 'Flexible week not found.' });
  if (!name) return res.status(400).json({ error: 'Enter a name for this completed week.' });
  const includedDays = FLEX_DAYS.filter((key) => week.dayStates?.[key]?.status !== 'not_in_week');
  if (!includedDays.every((key) => ['workout', 'rest'].includes(week.dayStates?.[key]?.status || ''))) return res.status(400).json({ error: 'Finish or mark Rest day for every day before completing the week.' });
  const sessions = data.sessions.filter((session) => session.weekId === week.id && session.status === 'finished');
  const template: Week = {
    ...week, id: id('week'), name, active: false, status: 'program', mode: 'planned', programId: undefined,
    days: FLEX_DAYS.map((key) => {
      const session = sessions.find((item) => item.dayKey === key);
      const source = week.days.find((item) => item.key === key)!;
      const exercises: PlannedExercise[] = (session?.logs || []).filter((log) => log.status === 'completed').map((log) => {
        const work = workSets(log.sets); const reps = work.map((set) => Number(set.r) || 0).filter(Boolean); const count = work.length || 1;
        const repText = reps.length ? `${Math.min(...reps)}${Math.max(...reps) !== Math.min(...reps) ? `-${Math.max(...reps)}` : ''}` : '8-12';
        return { name: log.name, target: log.target, vol: `${count} x ${repText}`, cue: '', exerciseId: log.exerciseId, familyId: log.familyId, trackingMode: log.trackingMode };
      });
      return { ...source, type: exercises.length ? 'training' : 'rest', title: exercises.length ? (session?.dayTitle || 'Flexible workout') : 'Rest day', muscles: session?.targetMuscles || [], exercises };
    }),
  };
  repo.upsertWeek(template);
  repo.saveProgram({ id: id('program'), name, notes: `Compiled from flexible week ending ${week.flexibleEndDate || week.startDate}.`, weeks: [{ weekId: template.id, weekNumber: 1, phase: 'accumulate', name }], active: false, createdAt: new Date().toISOString() });
  repo.upsertWeek({ ...week, name: `${name} — history`, status: 'completed' });
  res.json({ ok: true, templateId: template.id });
});

apiRouter.post('/sessions', (req, res) => {
  req.body = sessionInputSchema.parse(req.body);
  const previous = req.body.id ? repo.getSession(req.body.id) : null;
  if (previous) {
    if (canonical(previous.logs.map(({aiCoachComment, ...log}) => log)) !== canonical(req.body.logs.map((log: Record<string, unknown>) => ({...log, aiCoachComment: undefined}))) || previous.date !== req.body.date) return res.status(409).json({error:'This session ID already exists with different data. Open Records to edit it.'});
    const db = repo.loadAppDb(); const settings = repo.getSettings();
    return res.json({session:previous,analytics:computeMetrics(db,settings),coach:localCoach(db,settings)});
  }
  const data = repo.loadAppDb();
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  let ready = null;
  if (req.body.weekId && req.body.dayKey) {
    ready = data.readiness.find((r) => r.weekId === req.body.weekId && r.dayKey === req.body.dayKey);
  }
  if (!ready) {
    ready = data.readiness.find((r) => r.date === date);
  }
  if (!ready && !req.body.completedByLibrary) {
    return res.status(400).json({ error: 'Complete today readiness before logging exercise data.' });
  }
  const week =
    data.weeks.find((w) => w.id === req.body.weekId) ||
    data.weeks.find((w) => w.id === data.meta.activeWeekId) ||
    ({} as { name?: string; weekNumber?: string });
  const profile = repo.getProfile();
  const session: Session = {
    id: req.body.id || id('session'),
    status: 'finished',
    createdAt: new Date().toISOString(),
    weekName: week.name || req.body.weekName || '',
    weekNumber: week.weekNumber || req.body.weekNumber || '',
    weekId: req.body.weekId || data.meta.activeWeekId,
    dayKey: req.body.dayKey,
    dayTitle: req.body.dayTitle || '',
    date,
    name: req.body.name || profile.displayName,
    sleep: ready?.sleepHours ?? req.body.sleep ?? '',
    soreness: ready?.soreness ?? req.body.soreness ?? '',
    logs: Array.isArray(req.body.logs) ? req.body.logs : [],
    readiness: ready || req.body.readiness || null,
    completedByLibrary: Boolean(req.body.completedByLibrary),
    notes: req.body.notes || '',
    startedAt: req.body.startedAt || undefined,
    endedAt: req.body.endedAt || new Date().toISOString(),
    durationMinutes: req.body.durationMinutes != null ? Number(req.body.durationMinutes) : undefined,
    originalDayKey: req.body.originalDayKey || undefined,
    originalDate: req.body.originalDate || undefined,
    mode: req.body.mode === 'flexible' ? 'flexible' : 'planned',
    targetMuscles: Array.isArray(req.body.targetMuscles) ? req.body.targetMuscles.map(String) : undefined,
  };
  if (repo.findDuplicateSession(session.weekId, session.dayKey)) {
    return res.status(409).json({
      error: 'This day already has a saved record for the selected week. Open Records to edit it instead.',
    });
  }
  repo.saveSession(session);
  // A flexible workout is also the completion record for that calendar day.
  const flexibleWeek = data.weeks.find((w) => w.id === session.weekId && w.mode === 'flexible');
  if (flexibleWeek) {
    const nextKey = FLEX_DAYS[FLEX_DAYS.indexOf(session.dayKey) + 1];
    const dayStates: Record<string, FlexibleDayState> = {
      ...(flexibleWeek.dayStates || {}),
      [session.dayKey]: { status: 'workout', date: session.date, completedAt: new Date().toISOString() },
    };
    if (nextKey && dayStates[nextKey]?.status === 'locked') dayStates[nextKey] = { ...dayStates[nextKey], status: 'ready' };
    repo.upsertWeek({
      ...flexibleWeek,
      dayStates,
    });
  }
  repo.logEvent('session.create', { id: session.id });
  const next = repo.loadAppDb();
  const appSettings = repo.getSettings();
  
  if (!req.body.localOnly && appSettings.telegramBotToken && appSettings.telegramChatId && session.logs.length > 0) {
    pdf.generateDailyReportHtml(session.id)
      .then(buffer => telegram.sendTelegramDocument(`daily-report-${session.date}.html`, buffer, `Daily Report: ${session.name} - ${session.date}`))
      .catch(err => console.error('[api] failed to send daily report', err));
  }

  res.json({
    session,
    analytics: computeMetrics(next, appSettings),
    coach: localCoach(next, appSettings),
  });
});

apiRouter.post('/sessions/finish-and-send', async (req, res, next) => {
  try {
    req.body = sessionInputSchema.parse(req.body);
    const previous = req.body.id ? repo.getSession(req.body.id) : null;
    if (previous) {
      if (canonical(previous.logs.map(({aiCoachComment, ...log}) => log)) !== canonical(req.body.logs.map((log: Record<string, unknown>) => ({...log, aiCoachComment: undefined}))) || previous.date !== req.body.date) return res.status(409).json({error:'This session ID already exists with different data. Open Records to edit it.'});
      const db = repo.loadAppDb(); const settings = repo.getSettings();
      return res.json({session:previous,analytics:computeMetrics(db,settings),coach:localCoach(db,settings)});
    }
    const data = repo.loadAppDb();
    const appSettings = repo.getSettings();
    
    // Construct the session
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    let ready = null;
    if (req.body.weekId && req.body.dayKey) {
      ready = data.readiness.find((r) => r.weekId === req.body.weekId && r.dayKey === req.body.dayKey);
    }
    if (!ready) {
      ready = data.readiness.find((r) => r.date === date);
    }
    const week = data.weeks.find((w) => w.id === req.body.weekId) || data.weeks.find((w) => w.id === data.meta.activeWeekId) || {};
    const profile = repo.getProfile();
    
    const session: Session = {
      id: req.body.id || id('session'),
      status: 'finished',
      createdAt: req.body.createdAt || new Date().toISOString(),
      weekName: (week as any).name || req.body.weekName || '',
      weekNumber: (week as any).weekNumber || req.body.weekNumber || '',
      weekId: req.body.weekId || data.meta.activeWeekId,
      dayKey: req.body.dayKey,
      dayTitle: req.body.dayTitle || '',
      date,
      name: req.body.name || profile.displayName,
      sleep: ready?.sleepHours ?? req.body.sleep ?? '',
      soreness: ready?.soreness ?? req.body.soreness ?? '',
      logs: Array.isArray(req.body.logs) ? req.body.logs : [],
      readiness: ready || req.body.readiness || null,
      completedByLibrary: Boolean(req.body.completedByLibrary),
      notes: req.body.notes || '',
      startedAt: req.body.startedAt || undefined,
      endedAt: req.body.endedAt || new Date().toISOString(),
      durationMinutes: req.body.durationMinutes != null ? Number(req.body.durationMinutes) : undefined,
      originalDayKey: req.body.originalDayKey || undefined,
      originalDate: req.body.originalDate || undefined,
    };

    // Save before contacting outside services: the workout is never lost.
    repo.saveSession(session);
    repo.logEvent('session.finish_and_send', { id: session.id });
    const delivery = session.logs.length ? await reportDelivery.deliverSessionAiReport(session.id) : { ok: true as const, sentTo: [] };

    const nextDb = repo.loadAppDb();
    res.json({
      session,
      analytics: computeMetrics(nextDb, appSettings),
      coach: localCoach(nextDb, appSettings),
      delivery,
    });
  } catch (e) {
    next(e);
  }
});

function canReportWeek(data: AppDb, week: Week) {
  if (data.trainingConfig?.preplannedWeekMode === false) return week.mode === 'flexible';
  return week.id === data.meta.activeWeekId && week.mode !== 'flexible' && week.status !== 'program';
}

apiRouter.get(['/reports/session/:sessionId/html', '/reports/session/:sessionId/pdf'], async (req, res, next) => {
  try {
    await ensureSessionReportAnalysis(req.params.sessionId);
    const buffer = await pdf.generateDailyReportHtml(req.params.sessionId);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=session-report-${req.params.sessionId}.html`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

apiRouter.get(['/reports/week/:weekId/html', '/reports/week/:weekId/pdf'], async (req, res, next) => {
  try {
    const data = repo.loadAppDb();
    const week = data.weeks.find((item) => item.id === req.params.weekId);
    if (!week || !canReportWeek(data, week)) return res.status(403).json({ error: 'Reports are limited to the active planned week or flexible weeks in Flexible mode.' });
    const sessions = data.sessions.filter((s) => s.weekId === req.params.weekId && s.status === 'finished');
    for (const session of sessions) await ensureSessionReportAnalysis(session.id);
    const buffer = await pdf.generateWeeklyReportHtml(req.params.weekId);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=weekly-report-${req.params.weekId}.html`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

/** Adds missing AI commentary to historical sessions before a full PDF is built. */
async function ensureSessionReportAnalysis(sessionId: string): Promise<void> {
  const data = repo.loadAppDb();
  const session = data.sessions.find((s) => s.id === sessionId);
  const settings = repo.getSettings();
  if (!session || !settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) return;
  const completed = session.logs.filter((log) => log.status === 'completed');
  if (session.aiOverallSummary && completed.every((log) => log.aiCoachComment)) return;
  const result = await generateSessionReport(data, settings, session);
  if (!result.ok || !result.report) return;
  session.aiOverallSummary = result.report.overallSummary;
  for (const log of completed) {
    const comment = result.report.exerciseComments[log.name];
    if (comment) log.aiCoachComment = comment;
  }
  repo.saveSession(session);
}

apiRouter.get(['/reports/progress/html', '/reports/progress/pdf'], async (req, res, next) => {
  try {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const buffer = await pdf.generateProgressReportHtml(from, to);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename=progress-report.html');
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

apiRouter.get('/sessions', (_req, res) => {
  res.json(repo.listSessions());
});

apiRouter.get('/sessions/previous-sets', (req, res) => {
  const name = String(req.query.exercise || '');
  if (!name) return res.status(400).json({ error: 'exercise query required' });
  const sessions = repo.listSessions().filter((s) => s.status === 'finished');
  for (let i = sessions.length - 1; i >= 0; i--) {
    const log = (sessions[i].logs || []).find((l) => l.name === name && l.status !== 'skipped');
    if (log?.sets?.length) {
      return res.json({ date: sessions[i].date, sets: log.sets, exercise: name });
    }
  }
  res.json({ date: null, sets: [], exercise: name });
});

apiRouter.get('/progression', (req, res) => {
  const data = repo.loadAppDb();
  const names = String(req.query.exercises || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list =
    names.length > 0
      ? names
      : (data.weeks.find((w) => w.id === data.meta.activeWeekId)?.days || [])
          .flatMap((d) => d.exercises.map((e) => e.name))
          .slice(0, 20);
  res.json({ tips: buildProgression(data, list) });
});

apiRouter.put('/sessions/:sessionId', (req, res) => {
  req.body = sessionInputSchema.parse(req.body);
  const existing = repo.getSession(req.params.sessionId);
  if (!existing) return res.status(404).json({ error: 'Record not found.' });
  const data = repo.loadAppDb();
  const week =
    data.weeks.find((w) => w.id === req.body.weekId) ||
    data.weeks.find((w) => w.id === existing.weekId) ||
    {};
  const session: Session = {
    ...existing,
    ...req.body,
    id: req.params.sessionId,
    status: 'finished',
    weekId: req.body.weekId || existing.weekId,
    weekName: (week as { name?: string }).name || req.body.weekName || existing.weekName || '',
    weekNumber:
      (week as { weekNumber?: string | number }).weekNumber ||
      req.body.weekNumber ||
      existing.weekNumber ||
      '',
    updatedAt: new Date().toISOString(),
  };
  if (repo.findDuplicateSession(session.weekId, session.dayKey, session.id)) {
    return res.status(409).json({ error: 'Another saved record already exists for this week day.' });
  }
  repo.saveSession(session);
  const next = repo.loadAppDb();
  const appSettings = repo.getSettings();

  if (!req.body.localOnly && appSettings.telegramBotToken && appSettings.telegramChatId && session.logs.length > 0) {
    pdf.generateDailyReportHtml(session.id)
      .then(buffer => telegram.sendTelegramDocument(`daily-report-${session.date}.html`, buffer, `Daily Report Updated: ${session.name} - ${session.date}`))
      .catch(err => console.error('[api] failed to send daily report', err));
  }

  res.json({
    session,
    analytics: computeMetrics(next, appSettings),
    coach: localCoach(next, appSettings),
  });
});

apiRouter.delete('/sessions/:sessionId', (req, res) => {
  try {
    repo.deleteSession(req.params.sessionId);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : 'Not found' });
  }
});

apiRouter.post('/sessions/import', (req, res) => {
  const data = repo.loadAppDb();
  if (Array.isArray(req.body.weeks)) {
    for (const rawWeek of req.body.weeks) {
      try {
        if (rawWeek?.id && !data.weeks.some((w) => w.id === rawWeek.id)) {
          repo.upsertWeek(rawWeek);
        }
      } catch {
        /* skip bad week */
      }
    }
  }
  const incoming = Array.isArray(req.body)
    ? req.body
    : Array.isArray(req.body.sessions)
      ? req.body.sessions
      : [];
  if (!incoming.length) return res.status(400).json({ error: 'Import needs a sessions array or backup JSON.' });
  let imported = 0;
  let skipped = 0;
  for (const raw of incoming) {
    if (!sessionInputSchema.safeParse(raw).success) { skipped++; continue; }
    if (!raw.weekId || !raw.dayKey) {
      skipped++;
      continue;
    }
    const session: Session = {
      id: raw.id || id('session'),
      status: 'finished',
      createdAt: raw.createdAt || new Date().toISOString(),
      date: raw.date || new Date().toISOString().slice(0, 10),
      logs: Array.isArray(raw.logs) ? raw.logs : [],
      weekId: raw.weekId,
      weekName: raw.weekName || '',
      weekNumber: raw.weekNumber || '',
      dayKey: raw.dayKey,
      dayTitle: raw.dayTitle || '',
      name: raw.name || repo.getProfile().displayName,
      sleep: raw.sleep ?? '',
      soreness: raw.soreness ?? '',
      readiness: raw.readiness || null,
      completedByLibrary: Boolean(raw.completedByLibrary),
    };
    if (repo.getSession(session.id)) {
      skipped++;
      continue;
    }
    if (repo.findDuplicateSession(session.weekId, session.dayKey, session.id)) {
      skipped++;
      continue;
    }
    repo.saveSession(session);
    imported++;
  }
  res.json({ ok: true, imported, skipped });
});

apiRouter.get('/analytics', (_req, res) => {
  const data = repo.loadAppDb();
  const appSettings = repo.getSettings();
  res.json({ analytics: computeMetrics(data, appSettings), coach: localCoach(data, appSettings) });
});

apiRouter.post('/targets', (req, res) => {
  const body = req.body || {};
  const existingId = body.id ? String(body.id) : '';
  const existing = existingId ? repo.listTargets().find((t) => t.id === existingId) : null;
  const item = {
    id: existing?.id || id('target'),
    createdAt: existing?.createdAt || new Date().toISOString(),
    name: String(body.name || existing?.name || 'Goal'),
    type: String(body.type ?? existing?.type ?? ''),
    current: body.current ?? existing?.current ?? '',
    target: body.target ?? existing?.target ?? '',
    unit: String(body.unit ?? existing?.unit ?? ''),
    status: String(body.status ?? existing?.status ?? 'active'),
    deadline: body.deadline !== undefined ? String(body.deadline || '') : existing?.deadline || '',
    linkedExercise:
      body.linkedExercise !== undefined
        ? String(body.linkedExercise || '')
        : existing?.linkedExercise || '',
  };
  res.json(repo.saveTarget(item));
});

apiRouter.delete('/targets/:targetId', (req, res) => {
  repo.deleteTarget(req.params.targetId);
  res.json({ ok: true });
});

apiRouter.post('/measurements', (req, res) => {
  const body = measurementInputSchema.parse(req.body || {});
  const existingId = body.id ? String(body.id) : '';
  const existing = existingId ? repo.listMeasurements().find((m) => m.id === existingId) : null;
  const item = {
    id: existing?.id || id('measure'),
    createdAt: existing?.createdAt || new Date().toISOString(),
    date: String(body.date || existing?.date || new Date().toISOString().slice(0, 10)),
    weight: body.weight ?? existing?.weight ?? '',
    neck: body.neck ?? existing?.neck ?? '',
    waist: body.waist ?? existing?.waist ?? '',
    chest: body.chest ?? existing?.chest ?? '',
    arms: body.arms ?? existing?.arms ?? '',
    hips: body.hips ?? existing?.hips ?? '',
    bodyFat: body.bodyFat ?? existing?.bodyFat ?? '',
    bmr: body.bmr ?? existing?.bmr ?? '',
    muscleMass: body.muscleMass ?? existing?.muscleMass ?? '',
    waterPercentage: body.waterPercentage ?? existing?.waterPercentage ?? '',
    notes: String(body.notes ?? existing?.notes ?? ''),
  };
  res.json(repo.saveMeasurement(item));
});

apiRouter.delete('/measurements/:measurementId', (req, res) => {
  repo.deleteMeasurement(req.params.measurementId);
  res.json({ ok: true });
});

apiRouter.delete('/habits/:habitId', (req, res) => {
  repo.deleteHabit(req.params.habitId);
  res.json({ ok: true });
});

apiRouter.delete('/cardio/:cardioId', (req, res) => {
  repo.deleteCardioSession(req.params.cardioId);
  res.json({ ok: true });
});

apiRouter.post('/cloud-sync/run', async (req, res, next) => {
  try {
    const config = { apiKey: String(req.body?.apiKey || ''), projectId: String(req.body?.projectId || '') };
    const session = req.body?.idToken ? await firebaseSessionFromToken(config, String(req.body.idToken)) : await firebaseSignIn(config, String(req.body?.email || ''), String(req.body?.password || ''));
    res.json(await runDesktopSync(config, session, 'desktop', req.body?.choices || {}));
  } catch (error) { next(error); }
});

apiRouter.post('/cloud-sync/preview', async (req, res, next) => {
  try {
    const config = { apiKey: String(req.body?.apiKey || ''), projectId: String(req.body?.projectId || '') };
    const session = req.body?.idToken ? await firebaseSessionFromToken(config, String(req.body.idToken)) : await firebaseSignIn(config, String(req.body?.email || ''), String(req.body?.password || ''));
    const deviceId = String(req.body?.deviceId || 'desktop');
    res.json(await previewCloudSync(repo.loadAppDb(), config, session, deviceId));
  } catch (error) { next(error); }
});

apiRouter.post('/cloud-sync/upload-initial', async (req, res, next) => {
  try {
    const config = { apiKey: String(req.body?.apiKey || ''), projectId: String(req.body?.projectId || '') };
    const session = req.body?.idToken ? await firebaseSessionFromToken(config, String(req.body.idToken)) : await firebaseSignIn(config, String(req.body?.email || ''), String(req.body?.password || ''));
    const deviceId = String(req.body?.deviceId || 'desktop');
    const preview = await previewCloudSync(repo.loadAppDb(), config, session, deviceId);
    if (preview.conflicts.length || preview.remoteRecords) return res.status(409).json({ error: 'Initial upload requires an empty cloud account. Use the merge flow instead.', preview });
    const safety = createPreUpdateSafetyBackup('manual');
    await runDesktopSync(config, session, deviceId);
    res.json({ ok: true, uploaded: preview.localRecords, safetyBackup: safety });
  } catch (error) { next(error); }
});

apiRouter.get('/settings', (_req, res) => {
  res.json(repo.publicSettings());
});

apiRouter.post('/settings', (req, res) => {
  const body = req.body || {};
  const aiProvider = ['openrouter', 'nvidia', 'ollama', 'local', ''].includes(
    String(body.aiProvider || '').toLowerCase(),
  )
    ? String(body.aiProvider || '').toLowerCase()
    : repo.getSettings().aiProvider || 'openrouter';
  const aiModel =
    body.aiModel !== undefined && body.aiModel !== null
      ? String(body.aiModel || (aiProvider === 'ollama' ? 'llama3' : aiProvider === 'nvidia' ? 'meta/llama-3.1-8b-instruct' : DEFAULT_OPENROUTER_MODEL))
      : undefined;
  repo.saveSettings({
    ...(body.userEmail !== undefined ? { userEmail: String(body.userEmail || '') } : {}),
    senderName: body.senderName,
    senderEmail: body.senderEmail,
    appPassword: body.appPassword,
    recipients: recipients(body.recipients),
    streakStartDate: body.streakStartDate || '',
    aiProvider: aiProvider === 'local' ? '' : aiProvider,
    aiApiKey: body.aiApiKey,
    ...(body.openRouterApiKey !== undefined ? { openRouterApiKey: body.openRouterApiKey } : {}),
    ...(body.nvidiaNimApiKey !== undefined ? { nvidiaNimApiKey: body.nvidiaNimApiKey } : {}),
    // Keep the selected key available to the matching provider as well. This prevents
    // a later provider switch from resurrecting an old key.
    ...(body.aiApiKey ? (aiProvider === 'nvidia' ? { nvidiaNimApiKey: body.aiApiKey } : aiProvider === 'openrouter' ? { openRouterApiKey: body.aiApiKey } : {}) : {}),
    ...(aiModel !== undefined ? { aiModel } : {}),
    ...(body.telegramBotToken !== undefined ? { telegramBotToken: body.telegramBotToken } : {}),
    ...(body.telegramChatId !== undefined ? { telegramChatId: body.telegramChatId } : {}),
    ...(body.reportSchedule !== undefined ? { reportSchedule: body.reportSchedule } : {}),
    ...(body.gender !== undefined ? { gender: body.gender } : {}),
    ...(body.googleClientId !== undefined ? { googleClientId: body.googleClientId } : {}),
    ...(body.googleClientSecret !== undefined ? { googleClientSecret: body.googleClientSecret } : {}),
    ...(body.gdriveSchedule !== undefined && ['daily', 'weekly', 'monthly'].includes(body.gdriveSchedule)
      ? { gdriveSchedule: body.gdriveSchedule }
      : {}),
    ...(body.isActivated !== undefined ? { isActivated: Boolean(body.isActivated) } : {}),
    ...(body.hasSeenFeatureGuide !== undefined ? { hasSeenFeatureGuide: body.hasSeenFeatureGuide } : {}),
    // githubUpdatesRepo is LOCKED in code (src/shared/update-repo.ts) — never accept client changes
    ...(body.autoCheckUpdates !== undefined
      ? { autoCheckUpdates: Boolean(body.autoCheckUpdates) }
      : {}),
  });
  if (body.profileName || body.units || body.height !== undefined) {
    repo.saveProfile({
      displayName: body.profileName,
      units: body.units === 'lb' ? 'lb' : 'kg',
      height: body.height,
    });
  }
  res.json(repo.publicSettings());
});

apiRouter.get('/reports/pending', (_req, res) => res.json({ reports: reportDelivery.pendingReports() }));
apiRouter.post('/reports/pending/retry', async (_req, res) => res.json({ results: await reportDelivery.retryPendingReports() }));

apiRouter.get('/google-fit/auth', (req, res) => {
  const s = repo.getSettings();
  if (!s.googleClientId || !s.googleClientSecret) {
    return res.status(400).json({ error: 'Upload and save the Google OAuth credential JSON before authorizing Google Fit.' });
  }
  const redirectUri = `http://127.0.0.1:${PORT}/api/google-fit/callback`;
  const url = googleFit.getGoogleAuthUrl(s.googleClientId, redirectUri);
  res.json({ url });
});

apiRouter.get('/google-fit/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Code is required');
  const s = repo.getSettings();
  if (!s.googleClientId || !s.googleClientSecret) {
    return res.status(400).send('Google OAuth credentials missing.');
  }
  const redirectUri = `http://127.0.0.1:${PORT}/api/google-fit/callback`;
  try {
    const tokens = await googleFit.exchangeGoogleCode(s.googleClientId, s.googleClientSecret, code, redirectUri);
    if (!tokens.refresh_token) {
      return res.status(400).send('Google did not provide a reusable connection. Remove Body OS from your Google Account permissions, then choose Authorize & Connect again.');
    }
    const saved = repo.saveSettings({ googleRefreshToken: tokens.refresh_token });
    if (!saved.googleRefreshToken) throw new Error('Body OS could not save the Google Fit connection. Reopen Body OS and authorize again.');
    res.send('<script>window.close();</script><h2>Successfully connected to Google Fit! You can close this window.</h2>');
  } catch (e: any) {
    res.status(500).send(`Error: ${e.message}`);
  }
});

apiRouter.post('/google-fit/sync', async (req, res) => {
  const preview = req.query.preview === 'true';
  const s = repo.getSettings();
  if (!s.googleClientId || !s.googleClientSecret || !s.googleRefreshToken) {
    return res.status(400).json({ error: 'Google Fit not fully authorized.' });
  }
  try {
    const tokens = await googleFit.refreshGoogleToken(s.googleClientId, s.googleClientSecret, s.googleRefreshToken);
    const accessToken = tokens.access_token;
    
    // Sync last 30 days
    const endTime = Date.now();
    const startTime = endTime - 30 * 24 * 60 * 60 * 1000;
    const startTimeNs = startTime * 1000000;
    const endTimeNs = endTime * 1000000;
    
    const weightData = await googleFit.fetchGoogleFitWeight(accessToken, startTimeNs, endTimeNs);
    
    // Fetch advanced metrics
    const sleepData = await googleFit.fetchGoogleFitDataByType(accessToken, startTimeNs, endTimeNs, 'com.google.sleep.segment');
    const sleepSessions = await googleFit.fetchGoogleFitSleepSessions(accessToken, startTime, endTime);
    const hrData = await googleFit.fetchGoogleFitDataByType(accessToken, startTimeNs, endTimeNs, 'com.google.heart_rate.bpm');
    const stepData = await googleFit.fetchGoogleFitDataByType(accessToken, startTimeNs, endTimeNs, 'com.google.step_count.delta');
    const hydrationData = await googleFit.fetchGoogleFitDataByType(accessToken, startTimeNs, endTimeNs, 'com.google.hydration');

    // Aggregate data by date
    const dailyMetrics: Record<string, any> = {};

    const getDayKey = (nanos: string) => new Date(parseInt(nanos) / 1000000).toISOString().split('T')[0];

    // Prefer the documented sleep-session data: an overnight session belongs to the
    // day it ended, which is the day the user completes morning readiness.
    if (sleepSessions?.session?.length) {
      sleepSessions.session.forEach((session) => {
        const endMs = Number(session.endTimeMillis);
        const startMs = Number(session.startTimeMillis);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;
        const dKey = new Date(endMs).toISOString().split('T')[0];
        if (!dailyMetrics[dKey]) dailyMetrics[dKey] = {};
        const durationHours = (endMs - startMs) / 3_600_000;
        dailyMetrics[dKey].sleepHours = Math.round(((dailyMetrics[dKey].sleepHours || 0) + durationHours) * 10) / 10;
      });
    } else if (sleepData?.point) {
      sleepData.point.forEach((pt: any) => {
        const dKey = getDayKey(pt.startTimeNanos);
        if (!dailyMetrics[dKey]) dailyMetrics[dKey] = {};
        const durationHours = (parseInt(pt.endTimeNanos) - parseInt(pt.startTimeNanos)) / 1000000 / 1000 / 60 / 60;
        dailyMetrics[dKey].sleepHours = (dailyMetrics[dKey].sleepHours || 0) + durationHours;
      });
    }

    if (hrData?.point) {
      hrData.point.forEach((pt: any) => {
        const dKey = getDayKey(pt.startTimeNanos);
        if (!dailyMetrics[dKey]) dailyMetrics[dKey] = {};
        if (pt.value && pt.value.length > 0) {
          dailyMetrics[dKey].hrSum = (dailyMetrics[dKey].hrSum || 0) + pt.value[0].fpVal;
          dailyMetrics[dKey].hrCount = (dailyMetrics[dKey].hrCount || 0) + 1;
        }
      });
    }

    if (stepData?.point) {
      stepData.point.forEach((pt: any) => {
        const dKey = getDayKey(pt.startTimeNanos);
        if (!dailyMetrics[dKey]) dailyMetrics[dKey] = {};
        if (pt.value && pt.value.length > 0) {
          dailyMetrics[dKey].steps = (dailyMetrics[dKey].steps || 0) + pt.value[0].intVal;
        }
      });
    }

    if (hydrationData?.point) {
      hydrationData.point.forEach((pt: any) => {
        const dKey = getDayKey(pt.startTimeNanos);
        if (!dailyMetrics[dKey]) dailyMetrics[dKey] = {};
        if (pt.value && pt.value.length > 0) {
          dailyMetrics[dKey].hydration = (dailyMetrics[dKey].hydration || 0) + pt.value[0].fpVal;
        }
      });
    }


    let readinessUpdated = 0;
    const allReadiness = repo.listReadiness();
    
    for (const [date, metrics] of Object.entries(dailyMetrics)) {
      let readi = allReadiness.find(r => r.date === date);
      if (readi) {
        let updated = false;
        if (metrics.sleepHours && !readi.sleepHours) { readi.sleepHours = Math.round(metrics.sleepHours * 10) / 10; updated = true; }
        if (metrics.hrCount && !readi.restingHeartRate) { readi.restingHeartRate = Math.round(metrics.hrSum / metrics.hrCount); updated = true; }
        if (metrics.steps && (!readi.steps || readi.steps === 0)) { readi.steps = metrics.steps; updated = true; }
        if (metrics.hydration && (!readi.hydration || readi.hydration === 0)) { readi.hydration = Math.round(metrics.hydration * 100) / 100; updated = true; }
        
        if (updated && !preview) {
          repo.saveReadiness(readi);
          readinessUpdated++;
        }
      }
    }
    
    let added = 0;
    if (!preview && weightData?.point && Array.isArray(weightData.point)) {
      for (const pt of weightData.point) {
        if (pt.value && pt.value.length > 0) {
          const weightKg = pt.value[0].fpVal;
          const timestamp = new Date(parseInt(pt.startTimeNanos) / 1000000).toISOString();
          
          // Check if measurement exists near this date
          const existing = repo.listMeasurements().find((m: any) => Math.abs(new Date(m.date).getTime() - new Date(timestamp).getTime()) < 24 * 60 * 60 * 1000);
          
          if (!existing) {
            repo.saveMeasurement({
              id: id('meas'),
              date: timestamp.split('T')[0],
              weight: weightKg,
              notes: 'Imported from Google Fit',
              createdAt: new Date().toISOString()
            } as any);
            added++;
          }
        }
      }
    }
    
    let pushed = 0;
    
    // Push recent weightlifting sessions
    const sessions = preview ? [] : repo.listSessions().filter(s => s.status === 'completed' && new Date(s.date).getTime() > startTime);
    for (const session of sessions) {
      try {
        const d = new Date(session.date);
        d.setHours(12, 0, 0, 0); // approx start at noon
        const startMs = d.getTime();
        const endMs = startMs + 60 * 60 * 1000; // 1 hour approx
        
        await googleFit.pushGoogleFitWorkout(accessToken, {
          id: `wos-sess-${session.id}`,
          name: session.name || session.dayTitle || 'Workout',
          startTimeMs: startMs,
          endTimeMs: endMs,
          type: 'weightlifting',
          notes: session.notes
        });
        pushed++;
      } catch (e) {
        console.error('Failed to push session', e);
      }
    }
    
    // Push recent cardio sessions
    const cardio = preview ? [] : repo.listCardioSessions().filter(c => new Date(c.date).getTime() > startTime);
    for (const session of cardio) {
      try {
        const d = new Date(session.date);
        d.setHours(17, 0, 0, 0); // approx start at 5pm
        const startMs = d.getTime();
        const endMs = startMs + (session.durationMinutes * 60 * 1000);
        
        await googleFit.pushGoogleFitWorkout(accessToken, {
          id: `wos-cardio-${session.id}`,
          name: session.activity || 'Cardio',
          startTimeMs: startMs,
          endTimeMs: endMs,
          type: 'cardio',
          notes: session.notes
        });
        pushed++;
      } catch (e) {
        console.error('Failed to push cardio', e);
      }
    }
    
    if (!preview) {
      console.log('[DEBUG] Google Fit sync dailyMetrics:', JSON.stringify(dailyMetrics, null, 2));
      const fs = await import('node:fs');
      fs.writeFileSync('google-fit-debug.json', JSON.stringify({ dailyMetrics, sleepSessions, sleepData, stepData, hrData, hydrationData }, null, 2));
    }
    res.json({ ok: true, preview, metricsUpdated: readinessUpdated, weightAdded: added, dailyMetrics });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

apiRouter.post(
  '/send-report',
  rateLimit({ windowMs: 60_000, max: 5 }),
  async (req, res, next) => {
    try {
      const s = repo.getSettings();
      const to = recipients(
        req.body.recipients?.length ? req.body.recipients : s.recipients,
      );
      if (!s.senderEmail || !s.appPassword || !to.length) {
        return res.status(400).json({ error: 'Email settings are incomplete.' });
      }
      const data = repo.loadAppDb();
      const session = req.body.sessionId
        ? repo.getSession(req.body.sessionId)
        : (req.body.session as Session | undefined);
      if (!session) return res.status(404).json({ error: 'Session not found.' });
      const weekPart = session.weekNumber
        ? `Week ${session.weekNumber}`
        : session.weekName || 'Training Week';
      
      const delivery = await reportDelivery.deliverSessionAiReport(session.id);
      if (!delivery.ok) return res.status(202).json(delivery);
      res.json({ ok: true, sentTo: delivery.sentTo });
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/send-dummy-email',
  rateLimit({ windowMs: 60_000, max: 5 }),
  async (req, res, next) => {
    try {
      const s = repo.getSettings();
      const to = recipients(
        req.body.recipients?.length ? req.body.recipients : s.recipients,
      );
      await sendMail(s, {
        to,
        subject: `Body OS Test Email - ${new Date().toISOString().slice(0, 10)}`,
        html: '<div style="font-family:Arial;padding:20px"><h2>Body OS email is working.</h2><p>This is a dummy test email from Settings.</p></div>',
      });
      res.json({ ok: true, sentTo: to });
    } catch (e) {
      // Do not pass the raw SMTP response through the generic redactor: it turns a
      // useful Gmail setup problem into the unhelpful “Request failed”.
      res.status(400).json({ error: emailDeliveryMessage(e) });
    }
  },
);

/** —— Backup —— */
/** —— Skincare workspace —— */
apiRouter.get('/skin', (_req, res) => {
  res.json(repo.loadSkinState());
});

apiRouter.post('/skin/profile', (req, res) => {
  res.json(repo.saveSkinProfile(req.body || {}));
});

apiRouter.post('/skin/products', (req, res) => {
  const body = req.body || {};
  if (!String(body.name || '').trim()) return res.status(400).json({ error: 'Product name is required.' });
  res.json(repo.saveSkinProduct({ ...body, id: body.id || id('skinprod') }));
});

apiRouter.get('/skin/products/template', (_req, res) => {
  res.json(SKIN_PRODUCT_TEMPLATE);
});

apiRouter.post('/skin/products/import', (req, res) => {
  const payload = req.body?.products || req.body;
  res.json(repo.importSkinProducts(payload));
});

apiRouter.delete('/skin/products/:id', (req, res) => {
  repo.deleteSkinProduct(String(req.params.id));
  res.json({ ok: true });
});

apiRouter.post('/skin/routines', (req, res) => {
  const body = req.body || {};
  if (body.slot !== 'am' && body.slot !== 'pm') {
    return res.status(400).json({ error: 'Routine slot must be am or pm.' });
  }
  res.json(repo.saveSkinRoutine(body));
});

apiRouter.post('/skin/logs', async (req, res, next) => {
  try {
    const body = req.body || {};
    const log = repo.saveSkinLog({ ...body, id: body.id || id('skinlog') });
    const review = body.skipReview ? null : await runSkinLogReview(log, repo.getSettings());
    res.json({ log: repo.listSkinLogs().find((l) => l.id === log.id) || log, review, skin: repo.loadSkinState() });
  } catch (e) {
    next(e);
  }
});

apiRouter.delete('/skin/logs/:id', (req, res) => {
  repo.deleteSkinLog(String(req.params.id));
  res.json({ ok: true });
});

apiRouter.post(
  '/ai/skin',
  rateLimit({ windowMs: 60_000, max: 15 }),
  async (req, res, next) => {
    try {
      const result = await runSkinAsk(
        repo.loadSkinState(),
        repo.getSettings(),
        String(req.body?.question || ''),
        Array.isArray(req.body?.history) ? req.body.history : [],
      );
      res.status(result.ok ? 200 : 400).json({ ...result, skin: repo.loadSkinState() });
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.post(
  '/ai/skin/build-routine',
  rateLimit({ windowMs: 60_000, max: 8 }),
  async (req, res, next) => {
    try {
      const result = await runSkinBuildRoutine(repo.getSettings(), String(req.body?.prompt || ''));
      res.status(result.ok ? 200 : 400).json({ ...result, skin: repo.loadSkinState() });
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.get('/backup', (_req, res) => {
  res.json(repo.loadAppDb());
});

apiRouter.post('/backup/restore', async (req, res, next) => {
  try {
    const payload = (unwrapBackup(req.body) || req.body) as Partial<AppDb>;
    if (!payload.weeks || !payload.sessions) {
      return res.status(400).json({ error: 'Invalid backup format' });
    }
    repo.restoreBackup(payload);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** —— Habits & Lifestyle —— */
apiRouter.post('/habits', (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: 'Name is required' });
  const result = repo.saveHabit({
    id: body.id || id('habit'),
    name: String(body.name),
    target: Number(body.target || 0),
    unit: String(body.unit || ''),
    active: Boolean(body.active),
    createdAt: body.createdAt || new Date().toISOString(),
  });
  res.json(result);
});

apiRouter.post('/habit-logs', (req, res) => {
  const body = req.body || {};
  if (!body.habitId) return res.status(400).json({ error: 'habitId is required' });
  const result = repo.saveHabitLog({
    id: body.id || id('habitlog'),
    habitId: String(body.habitId),
    date: String(body.date || new Date().toISOString().slice(0, 10)),
    value: Number(body.value || 0),
    createdAt: body.createdAt || new Date().toISOString(),
  });
  res.json(result);
});

apiRouter.post('/cardio', (req, res) => {
  const body = req.body || {};
  if (!body.activity) return res.status(400).json({ error: 'activity is required' });
  const result = repo.saveCardioSession({
    id: body.id || id('cardio'),
    date: String(body.date || new Date().toISOString().slice(0, 10)),
    activity: String(body.activity),
    durationMinutes: Number(body.durationMinutes || 0),
    distance: body.distance ?? '',
    perceivedEffort: body.perceivedEffort ?? '',
    notes: String(body.notes || ''),
    createdAt: body.createdAt || new Date().toISOString(),
  });
  res.json(result);
});

apiRouter.post('/goal-checkins', (req, res) => {
  const body = req.body || {};
  if (!body.goalId) return res.status(400).json({ error: 'goalId is required' });
  const result = repo.saveGoalCheckIn({
    id: body.id || id('gcheck'),
    goalId: String(body.goalId),
    date: String(body.date || new Date().toISOString().slice(0, 10)),
    value: Number(body.value || 0),
    note: String(body.note || ''),
    createdAt: body.createdAt || new Date().toISOString(),
  });
  res.json(result);
});

apiRouter.post('/weekly-reviews', (req, res) => {
  const body = req.body || {};
  if (!body.weekStart) return res.status(400).json({ error: 'weekStart is required' });
  const result = repo.saveWeeklyReview({
    id: body.id || id('review'),
    weekStart: String(body.weekStart),
    wins: String(body.wins || ''),
    blockers: String(body.blockers || ''),
    adjustment: String(body.adjustment || ''),
    createdAt: body.createdAt || new Date().toISOString(),
  });
  res.json(result);
});

/** —— Advanced training add-ons —— */
apiRouter.get('/exercises', (_req, res) => {
  res.json({ exercises: repo.listExercises() });
});

apiRouter.post('/exercises', (req, res) => {
  const body = req.body || {};
  const item = {
    id: body.id || id('ex'),
    name: String(body.name || 'Exercise'),
    aliases: Array.isArray(body.aliases) ? body.aliases : [],
    muscles: Array.isArray(body.muscles) ? body.muscles : [],
    equipment: String(body.equipment || ''),
    movementPattern: String(body.movementPattern || ''),
    substitutions: Array.isArray(body.substitutions) ? body.substitutions : [],
    bodyPart: body.bodyPart ? String(body.bodyPart) : undefined,
    workoutSplit: body.workoutSplit ? String(body.workoutSplit) : undefined,
    tutorialLink: body.tutorialLink ? String(body.tutorialLink) : undefined,
    familyId: body.familyId ? String(body.familyId) : undefined,
    defaultCue: body.defaultCue ? String(body.defaultCue) : undefined,
    defaultRestSec: body.defaultRestSec != null ? Number(body.defaultRestSec) : undefined,
    defaultTempo: body.defaultTempo ? String(body.defaultTempo) : undefined,
    trackingMode: body.trackingMode,
    meta: body.meta && typeof body.meta === 'object' ? body.meta : undefined,
  };
  res.json(repo.saveExercise(item));
});

apiRouter.post('/exercises/import', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array of exercises' });
  }
  let imported = 0;
  for (const body of req.body) {
    if (!body || typeof body !== 'object') continue;
    const item = {
      id: body.id || id('ex'),
      name: String(body.name || 'Exercise'),
      aliases: Array.isArray(body.aliases) ? body.aliases : [],
      muscles: Array.isArray(body.muscles) ? body.muscles : [],
      equipment: String(body.equipment || ''),
      movementPattern: String(body.movementPattern || ''),
      substitutions: Array.isArray(body.substitutions) ? body.substitutions : [],
      bodyPart: body.bodyPart ? String(body.bodyPart) : undefined,
      workoutSplit: body.workoutSplit ? String(body.workoutSplit) : undefined,
      tutorialLink: body.tutorialLink ? String(body.tutorialLink) : undefined,
      familyId: body.familyId ? String(body.familyId) : undefined,
      defaultCue: body.defaultCue ? String(body.defaultCue) : undefined,
      defaultRestSec: body.defaultRestSec != null ? Number(body.defaultRestSec) : undefined,
      defaultTempo: body.defaultTempo ? String(body.defaultTempo) : undefined,
      trackingMode: body.trackingMode,
      meta: body.meta && typeof body.meta === 'object' ? body.meta : undefined,
    };
    repo.saveExercise(item);
    imported++;
  }
  res.json({ imported });
});

apiRouter.delete('/exercises/:id', (req, res) => {
  repo.deleteExercise(req.params.id);
  res.json({ ok: true });
});

apiRouter.post('/library-splits', (req, res) => {
  try {
    res.json(repo.saveLibrarySplit({ ...(req.body || {}), id: req.body?.id || id('split') }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not save split.' });
  }
});

apiRouter.delete('/library-splits/:id', (req, res) => {
  repo.deleteLibrarySplit(req.params.id);
  res.json({ ok: true });
});

apiRouter.get('/exercise-history', (req, res) => {
  const name = String(req.query.name || '');
  if (!name) return res.status(400).json({ error: 'name required' });
  const data = repo.loadAppDb();
  const family =
    data.trainingConfig?.exerciseFamilies?.[name.toLowerCase()] ||
    data.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase())?.familyId;
  const relatedNames = new Set<string>([name]);
  if (family) {
    for (const [n, f] of Object.entries(data.trainingConfig?.exerciseFamilies || {})) {
      if (f === family) relatedNames.add(n);
    }
    for (const e of data.exercises) {
      if (e.familyId === family) relatedNames.add(e.name);
    }
  }
  const history: Array<{
    date: string;
    sessionId: string;
    dayTitle: string;
    name: string;
    sets: unknown[];
    bestE1rm: number;
    tonnage: number;
  }> = [];
  for (const s of data.sessions.filter((x) => x.status === 'finished').sort((a, b) => a.date.localeCompare(b.date))) {
    for (const log of s.logs || []) {
      const match =
        relatedNames.has(log.name) ||
        log.name.toLowerCase() === name.toLowerCase() ||
        (family && log.familyId === family);
      if (!match || log.status === 'skipped') continue;
      history.push({
        date: s.date,
        sessionId: s.id,
        dayTitle: s.dayTitle,
        name: log.name,
        sets: workSets(log.sets),
        bestE1rm: Math.round(bestSetE1rm(log) * 10) / 10,
        tonnage: logTonnage(log, true),
      });
    }
  }
  res.json({ name, familyId: family, history });
});

apiRouter.get('/programs', (_req, res) => {
  res.json({ programs: repo.listPrograms() });
});

apiRouter.post('/programs', (req, res) => {
  const body = req.body || {};
  const item = {
    id: body.id || id('prog'),
    name: String(body.name || 'Program'),
    notes: String(body.notes || ''),
    weeks: Array.isArray(body.weeks) ? body.weeks : [],
    active: Boolean(body.active),
    createdAt: body.createdAt || new Date().toISOString(),
    archived: Boolean(body.archived),
    updatedAt: body.updatedAt ? String(body.updatedAt) : new Date().toISOString(),
  };
  res.json(repo.saveProgram(item));
});

apiRouter.delete('/programs/:id', (req, res) => {
  repo.deleteProgram(req.params.id);
  res.json({ ok: true });
});

apiRouter.post('/pain-logs', (req, res) => {
  const body = req.body || {};
  if (!body.region) return res.status(400).json({ error: 'region required' });
  res.json(
    repo.savePainLog({
      id: body.id || id('pain'),
      date: String(body.date || new Date().toISOString().slice(0, 10)),
      region: String(body.region),
      severity: Number(body.severity || 1),
      notes: String(body.notes || ''),
      affectsTraining: Boolean(body.affectsTraining),
      createdAt: body.createdAt || new Date().toISOString(),
    }),
  );
});

apiRouter.delete('/pain-logs/:id', (req, res) => {
  repo.deletePainLog(req.params.id);
  res.json({ ok: true });
});

apiRouter.post('/schedule', (req, res) => {
  const body = req.body || {};
  if (!body.date) return res.status(400).json({ error: 'date required' });
  res.json(
    repo.saveScheduledWorkout({
      id: body.id || id('sched'),
      date: String(body.date),
      weekId: body.weekId ? String(body.weekId) : undefined,
      dayKey: body.dayKey ? String(body.dayKey) : undefined,
      title: String(body.title || 'Workout'),
      status: (body.status as 'planned' | 'done' | 'skipped' | 'rescheduled') || 'planned',
      notes: String(body.notes || ''),
      createdAt: body.createdAt || new Date().toISOString(),
    }),
  );
});

apiRouter.delete('/schedule/:id', (req, res) => {
  repo.deleteScheduledWorkout(req.params.id);
  res.json({ ok: true });
});

apiRouter.post('/training-config', (req, res) => {
  res.json(repo.saveTrainingConfig(req.body || {}));
});

apiRouter.get('/training-config', (_req, res) => {
  res.json(repo.getTrainingConfig());
});

apiRouter.post('/weeks/deload-from/:weekId', (req, res) => {
  const src = repo.getWeek(req.params.weekId);
  if (!src) return res.status(404).json({ error: 'Week not found' });
  const mult = Number(req.body?.volumeMultiplier || 0.6);
  const days = buildDeloadWeekDays(src, mult);
  const week = {
    ...src,
    id: id('week'),
    name: `${src.name} — Deload`,
    weekNumber: Number(src.weekNumber || 0) + 1 || '',
    active: false,
    phase: 'deload' as const,
    notes: (src.notes || '') + `\nAuto deload ×${mult}`,
    missionObjective: src.missionObjective ? `Deload after: ${src.missionObjective}` : 'Deload week',
    days,
  };
  const saved = repo.upsertWeek(week, false);
  res.json(saved);
});

apiRouter.post('/sessions/missed', (req, res) => {
  const body = req.body || {};
  const action = String(body.action || 'skip'); // skip | reschedule
  const weekId = String(body.weekId || '');
  const dayKey = String(body.dayKey || '');
  if (!weekId || !dayKey) return res.status(400).json({ error: 'weekId and dayKey required' });

  if (action === 'reschedule' && body.newDate) {
    const item = repo.saveScheduledWorkout({
      id: id('sched'),
      date: String(body.newDate),
      weekId,
      dayKey,
      title: String(body.title || `${dayKey} rescheduled`),
      status: 'rescheduled',
      notes: String(body.notes || 'Rescheduled missed session'),
      createdAt: new Date().toISOString(),
    });
    return res.json({ ok: true, scheduled: item });
  }

  // skip: mark scheduled as skipped + optional empty finished session
  if (body.createEmptyRecord) {
    const data = repo.loadAppDb();
    const week = data.weeks.find((w) => w.id === weekId);
    const day = week?.days.find((d) => d.key === dayKey);
    const session: Session = {
      id: id('session'),
      status: 'finished',
      createdAt: new Date().toISOString(),
      weekId,
      weekName: week?.name || '',
      weekNumber: week?.weekNumber || '',
      dayKey,
      dayTitle: day?.title || dayKey,
      date: String(body.date || new Date().toISOString().slice(0, 10)),
      name: repo.getProfile().displayName || 'Athlete',
      sleep: '',
      soreness: '',
      logs: (day?.exercises || []).map((e) => ({
        name: e.name,
        target: e.target,
        status: 'skipped',
        sets: [],
        journal: 'Missed session protocol — skipped',
      })),
      notes: 'Missed session — skipped via protocol',
      completedByLibrary: true,
    };
    if (!repo.findDuplicateSession(weekId, dayKey)) {
      repo.saveSession(session);
    }
  }
  res.json({ ok: true, action: 'skip' });
});

apiRouter.get('/export/csv', (_req, res) => {
  const data = repo.loadAppDb();
  const csv = sessionsToCsv(data.sessions);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=workout-os-sessions.csv');
  res.send(csv);
});

apiRouter.get('/export/measurements.csv', (_req, res) => {
  const data = repo.loadAppDb();
  const rows = ['date,weight,bodyFat,waist,neck,chest,arms,muscleMass,waterPercentage'];
  for (const m of data.measurements) {
    rows.push(
      [m.date, m.weight, m.bodyFat, m.waist, m.neck, m.chest, m.arms, m.muscleMass, m.waterPercentage]
        .map((v) => String(v ?? ''))
        .join(','),
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=workout-os-measurements.csv');
  res.send(rows.join('\n'));
});

/** —— Free GitHub auto-updates —— */
apiRouter.get(
  '/updates/check',
  rateLimit({ windowMs: 60_000, max: 12 }),
  async (req, res, next) => {
    try {
      const force = String(req.query.force || '') === '1' || req.query.force === 'true';
      const result = await checkForUpdates({ force });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

apiRouter.get('/updates/version', (_req, res) => {
  res.json({ version: getAppVersion() });
});

apiRouter.post(
  '/updates/download',
  rateLimit({ windowMs: 120_000, max: 4 }),
  async (_req, res, next) => {
    try {
      res.json(beginUpdateDownload());
    } catch (e) {
      next(e);
    }
  },
);

/** Sends an owner-authenticated support message to the Body OS developer. */
apiRouter.post(
  '/feedback',
  rateLimit({ windowMs: 60_000, max: 4 }),
  async (req, res, next) => {
    try {
      const category = String(req.body?.category || 'Feedback').slice(0, 60);
      const message = String(req.body?.message || '').trim();
      const replyTo = String(req.body?.replyTo || '').trim();
      if (message.length < 10) return res.status(400).json({ error: 'Please write at least a short description of your feedback.' });
      if (message.length > 6_000) return res.status(400).json({ error: 'Feedback is limited to 6,000 characters.' });

      const settings = repo.getSettings();
      if (!settings.senderEmail || !settings.appPassword) {
        return res.status(400).json({ error: 'Email delivery is not configured yet. Complete the Email Reports card in Settings first.' });
      }

      const safeCategory = escapeHtml(category);
      const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
      const safeReplyTo = escapeHtml(replyTo || settings.senderEmail);
      await sendMail(settings, {
        to: [DEVELOPER_FEEDBACK_EMAIL],
        subject: `Body OS feedback · ${category}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:680px;padding:24px"><h2>New Body OS feedback</h2><p><b>Category:</b> ${safeCategory}</p><p><b>Reply to:</b> ${safeReplyTo}</p><p><b>Body OS version:</b> ${escapeHtml(getAppVersion())}</p><hr style="border:0;border-top:1px solid #ddd"><p>${safeMessage}</p></div>`,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

apiRouter.get('/updates/download-status', (_req, res) => {
  res.json(getUpdateDownloadStatus());
});

apiRouter.get('/updates/notice', (_req, res) => {
  res.json({ notice: getUpdateNotice() });
});

apiRouter.post('/updates/notice/acknowledge', (_req, res) => {
  acknowledgeUpdateNotice();
  res.json({ ok: true });
});

apiRouter.post(
  '/updates/install',
  rateLimit({ windowMs: 120_000, max: 3 }),
  (_req, res) => {
    const result = applyDownloadedUpdate();
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  },
);

/** —— Google Drive Auto-Backup —— */
apiRouter.get('/gdrive/auth-url', (_req, res) => {
  try {
    const url = gdrive.getAuthUrl();
    res.json({ url });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

apiRouter.get('/gdrive/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code) throw new Error('No code provided');
    await gdrive.handleCallback(code, state);
    res.send('<script>window.close();</script><h2>Success! You can close this window and return to Body OS.</h2>');
  } catch (e) {
    res.status(400).send(`<h2>Error</h2><p>${escapeHtml((e as Error).message)}</p>`);
  }
});

apiRouter.post('/gdrive/backup', async (_req, res) => {
  const result = await gdrive.uploadBackup();
  if (!result.ok) return res.status(500).json(result);
  res.json(result);
});

apiRouter.get('/gdrive/backups', async (_req, res) => {
  const backups = await gdrive.listBackups();
  res.json({ backups });
});

apiRouter.post('/gdrive/restore', async (req, res) => {
  try {
    const fileId = String(req.body?.fileId || '');
    if (!fileId) return res.status(400).json({ error: 'fileId required' });
    const safety = createPreUpdateSafetyBackup('manual');
    if (!safety.ok) return res.status(500).json({ error: `Restore blocked: ${safety.error}` });
    const data = await gdrive.downloadBackup(fileId);
    const portable = data && typeof data === 'object' && (data as { format?: unknown }).format === 'body-os-portable-backup'
      ? snapshotFromRecords((data as { records?: unknown[] }).records as any)
      : (data as { db?: Partial<AppDb> }).db || data;
    repo.restoreBackup(portable);
    res.json({ ok: true, safetyBackup: { createdAt: safety.manifest.createdAt, localPath: safety.appBackupDir } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

apiRouter.post('/gdrive/disconnect', async (_req, res) => {
  await gdrive.disconnect();
  res.json({ ok: true });
});

export default apiRouter;
