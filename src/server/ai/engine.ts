import { aiWorkoutSchema, aiReportSchema, aiSkinSchema } from '../../shared/schemas.js';
import { id } from '../lib/ids.js';
import { getDb } from '../db/connection.js';
import type { AppDb, AppSettings, CoachResult, Session } from '../types.js';

import { localCoach } from '../services/coach.js';
import { chatCompletion, probeModel } from './client.js';
import { buildAthleteContext, parseAdviceLines } from './context.js';
import { getMcpTools } from './mcp.js';
import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_FREE_CHAT_MODELS,
  NVIDIA_MODELS,
  openRouterFallbackChain,
  modelLabel,
} from './models.js';
import { askMessages, briefMessages, coachMessages, morningBriefMessages, workoutGenMessages, plateauMessages, exerciseCueMessages, sessionReportMessages, skinAskMessages, skinReviewMessages, skinBuildMessages } from './prompts.js';
import { applyLocalBuild, applyLocalLogReview, applyNamedRoutines, createSkinToolRuntime } from './skin-tools.js';
import { localSkinAdvice, pauseActivesInRoutines, resumeActivesInRoutines, type SkinLog, type SkinState } from '../../shared/skin.js';
import * as repo from '../db/repository.js';

function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) return match[1].trim();
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  
  if (objStart !== -1 && objEnd !== -1 && (arrStart === -1 || objStart < arrStart)) {
      return text.substring(objStart, objEnd + 1).trim();
  } else if (arrStart !== -1 && arrEnd !== -1) {
      return text.substring(arrStart, arrEnd + 1).trim();
  }
  return text.trim();
}

function saveCoachHistory(source: string, score: number, advice: string[]): void {
  try {
    getDb()
      .prepare(
        'INSERT INTO coach_history (id, source, score, advice_json, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id('coach'), source, score, JSON.stringify(advice), new Date().toISOString());
  } catch {
    /* table may not exist on ancient DBs */
  }
}

export function listFreeModels() {
  return {
    recommended: DEFAULT_OPENROUTER_MODEL,
    recommendedLabel: modelLabel(DEFAULT_OPENROUTER_MODEL),
    fallbackChain: openRouterFallbackChain(),
    models: OPENROUTER_FREE_CHAT_MODELS,
    nvidiaModels: NVIDIA_MODELS,
  };
}

/**
 * Probe free models with the user's OpenRouter key and rank by success + latency.
 */
export async function benchmarkFreeModels(apiKey: string, limit = 5) {
  const candidates = OPENROUTER_FREE_CHAT_MODELS.slice(0, limit);
  const results: Array<{
    model: string;
    label: string;
    ok: boolean;
    latencyMs: number;
    error?: string;
    sample?: string;
    rank: number;
  }> = [];

  for (const m of candidates) {
    const r = await probeModel(apiKey, m.id, 'openrouter');
    results.push({
      model: m.id,
      label: m.label,
      ok: r.ok,
      latencyMs: r.latencyMs,
      error: r.error,
      sample: r.sample,
      rank: m.rank,
    });
  }

  const working = results.filter((r) => r.ok).sort((a, b) => a.latencyMs - b.latencyMs);
  const best = working[0] || null;

  return {
    testedAt: new Date().toISOString(),
    recommendedDefault: DEFAULT_OPENROUTER_MODEL,
    bestLive: best
      ? { model: best.model, label: best.label, latencyMs: best.latencyMs, sample: best.sample }
      : null,
    results,
  };
}

export async function testAiConnection(settings: AppSettings) {
  // aiApiKey is the key currently selected in Settings. It must win over an older
  // provider-specific key left from a previous configuration.
  const configuredKey = settings.aiApiKey || (settings.aiProvider === 'nvidia' ? settings.nvidiaNimApiKey : settings.openRouterApiKey);
  if (!settings.aiProvider || (!configuredKey && settings.aiProvider !== 'ollama')) {
    return {
      ok: false as const,
      error: 'Configure OpenRouter (or NVIDIA) API key in Settings first.',
    };
  }
  const provider = settings.aiProvider === 'nvidia' ? 'nvidia' : settings.aiProvider === 'ollama' ? 'ollama' : 'openrouter';
  const model =
    settings.aiModel ||
    (provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : provider === 'ollama' ? 'llama3' : 'meta/llama-3.1-8b-instruct');

  if (provider === 'openrouter' || provider === 'ollama') {
    // Prefer full chat path with fallback so test mirrors production coach
    const chat = await chatCompletion({
      provider,
      apiKey: configuredKey || '',
      model,
      // A selected free model can be temporarily capacity-limited. The official
      // OpenRouter free router is the next attempt, so testing reflects delivery.
      useFallback: provider === 'openrouter',
      temperature: 0.2,
      maxTokens: 80,
      messages: [
        {
          role: 'system',
          content: 'You are Body OS. Reply in one short sentence that coaching AI is online.',
        },
        { role: 'user', content: 'Test connection.' },
      ],
    });
    if (!chat.ok) {
      return { ok: false as const, error: chat.error, attempts: chat.attempts };
    }
    return {
      ok: true as const,
      provider: chat.provider,
      model: chat.model,
      modelLabel: modelLabel(chat.model),
      latencyMs: chat.latencyMs,
      sample: chat.content.slice(0, 200),
      attempts: chat.attempts,
      message: `AI engine online via ${chat.model}`,
    };
  }

  const probe = await probeModel(configuredKey || '', model, 'nvidia');
  if (!probe.ok) return { ok: false as const, error: probe.error, model };
  return {
    ok: true as const,
    provider: 'nvidia',
    model: probe.model,
    latencyMs: probe.latencyMs,
    sample: probe.sample,
    message: `AI engine online via ${probe.model}`,
  };
}

export async function runAiCoach(data: AppDb, settings: AppSettings): Promise<CoachResult> {
  const local = localCoach(data, settings);
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return {
      ...local,
      source: 'local',
      aiAvailable: false,
      aiError: 'Add an API key in Settings or choose Ollama to enable the AI engine.',
    };
  }

  const ctx = buildAthleteContext(data, settings, { includeSessions: true, recentSessionsCount: 3, includeMetrics: true });
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.35,
    maxTokens: 450,
    messages: coachMessages(JSON.stringify(ctx), local.advice),
  });

  if (!chat.ok) {
    return {
      ...local,
      source: 'local',
      aiAvailable: false,
      aiError: chat.error,
    };
  }

  const advice = parseAdviceLines(chat.content, 5);
  if (!advice.length) {
    return {
      ...local,
      source: 'local',
      aiAvailable: false,
      aiError: 'AI returned unusable text; using local coach.',
    };
  }

  const result: CoachResult = {
    score: local.score,
    advice,
    source: chat.provider,
    model: chat.model,
    aiAvailable: true,
    progression: local.progression,
  };
  saveCoachHistory(`${chat.provider}:${chat.model}`, result.score, advice);
  return result;
}

export async function runSessionBrief(
  data: AppDb,
  settings: AppSettings,
  session: Session,
): Promise<{ ok: boolean; bullets: string[]; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ok: false, bullets: [], error: 'AI key not configured' };
  }
  const ctx = buildAthleteContext(data, settings);
  const sessionJson = {
    date: session.date,
    day: session.dayTitle || session.dayKey,
    logs: (session.logs || []).map((l) => ({
      name: l.name,
      status: l.status,
      sets: l.sets,
      journal: l.journal,
    })),
  };
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.4,
    maxTokens: 350,
    messages: briefMessages(JSON.stringify(ctx), JSON.stringify(sessionJson)),
  });
  if (!chat.ok) return { ok: false, bullets: [], error: chat.error };
  return { ok: true, bullets: parseAdviceLines(chat.content, 5), model: chat.model };
}

export async function runAiAsk(
  data: AppDb,
  settings: AppSettings,
  question: string,
): Promise<{ ok: boolean; answer?: string; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ok: false, error: 'AI key not configured' };
  }
  const q = String(question || '').trim();
  if (q.length < 3) return { ok: false, error: 'Ask a longer question.' };
  if (q.length > 800) return { ok: false, error: 'Question too long.' };

  const ctx = buildAthleteContext(data, settings, { includeMeasurements: true, includeTargets: true });
  const allTools = await getMcpTools();
  const mcpTools = allTools.filter((tool) => String(tool?.function?.name || '').startsWith('bodyos__'));
  
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.4,
    maxTokens: 1000, // increased to allow tool reasoning
    messages: askMessages(JSON.stringify(ctx), q),
    tools: mcpTools.length > 0 ? mcpTools : undefined,
  });
  if (!chat.ok) return { ok: false, error: chat.error };
  return { ok: true, answer: chat.content.trim(), model: chat.model };
}

export async function runMorningBrief(
  data: AppDb,
  settings: AppSettings,
): Promise<{ ok: boolean; brief?: string; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ok: false, error: 'AI key not configured' };
  }
  const ctx = buildAthleteContext(data, settings);
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.4,
    maxTokens: 150,
    messages: morningBriefMessages(JSON.stringify(ctx)),
  });
  if (!chat.ok) return { ok: false, error: chat.error };
  return { ok: true, brief: chat.content.trim(), model: chat.model };
}

export async function runWorkoutGen(
  settings: AppSettings,
  prompt: string,
): Promise<{ ok: boolean; workout?: any; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ok: false, error: 'AI key not configured' };
  }
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.5,
    maxTokens: 500,
    messages: workoutGenMessages(prompt),
  });
  if (!chat.ok) return { ok: false, error: chat.error };
  try {
    const jsonStr = extractJson(chat.content);
    const workout = aiWorkoutSchema.parse(JSON.parse(jsonStr));
    return { ok: true, workout, model: chat.model };
  } catch (e) {
    return { ok: false, error: 'Failed to parse workout JSON from AI response.' };
  }
}

export async function runPlateauBuster(
  data: AppDb,
  settings: AppSettings,
  exerciseName: string,
): Promise<{ ok: boolean; advice?: string[]; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ok: false, error: 'AI key not configured' };
  }
  const ctx = buildAthleteContext(data, settings, { includePlateaus: true, includeProgression: true, specificExercise: exerciseName });
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.4,
    maxTokens: 250,
    messages: plateauMessages(JSON.stringify(ctx), exerciseName),
  });
  if (!chat.ok) return { ok: false, error: chat.error };
  return { ok: true, advice: parseAdviceLines(chat.content, 3), model: chat.model };
}

export async function runExerciseCues(
  settings: AppSettings,
  exerciseName: string,
): Promise<{ ok: boolean; cues?: string[]; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ok: false, error: 'AI key not configured' };
  }
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.3,
    maxTokens: 250,
    messages: exerciseCueMessages(exerciseName),
  });
  if (!chat.ok) return { ok: false, error: chat.error };
  return { ok: true, cues: parseAdviceLines(chat.content, 4), model: chat.model };
}

import { autoRegulateSession } from './client.js';
import { autoRegulateMessages } from './prompts.js';

export async function runAutoRegulate(
  data: AppDb,
  settings: AppSettings,
  plannedSessionJson: string,
): Promise<{ ok: boolean; workout?: any; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ok: false, error: 'AI key not configured' };
  }
  const ctx = buildAthleteContext(data, settings, { includeSessions: true, recentSessionsCount: 7 });
  const chat = await autoRegulateSession({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.5,
    maxTokens: 500,
    messages: autoRegulateMessages(JSON.stringify(ctx), plannedSessionJson),
  });
  if (!chat.ok) return { ok: false, error: chat.error };
  try {
    const jsonStr = extractJson(chat.content);
    const workout = aiWorkoutSchema.parse(JSON.parse(jsonStr));
    return { ok: true, workout, model: chat.model };
  } catch (e) {
    return { ok: false, error: 'Failed to parse auto-regulated JSON.' };
  }
}

export async function generateSessionReport(
  data: AppDb,
  settings: AppSettings,
  session: Session,
): Promise<{ ok: boolean; report?: { overallSummary: string; exerciseComments: Record<string, string> }; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ok: false, error: 'AI key not configured' };
  }
  
  const ctx = buildAthleteContext(data, settings, { includeMetrics: true });
  
  const sessionJson = JSON.stringify({
    date: session.date,
    day: session.dayTitle || session.dayKey,
    logs: (session.logs || []).map((l) => ({
      name: l.name,
      status: l.status,
      sets: l.sets,
      journal: l.journal,
    })),
  });

  // Extract previous performances for these exercises
  const previousSessionsData: Record<string, any[]> = {};
  for (const log of session.logs) {
    if (log.status !== 'completed') continue;
    const past = data.sessions
      .filter(s => s.status === 'finished' && s.id !== session.id)
      .map(s => {
         const match = s.logs.find(l => l.name === log.name && l.status === 'completed');
         if (match) return { date: s.date, sets: match.sets };
         return null;
      })
      .filter(Boolean)
      .slice(-3); // Get up to 3 most recent performances
    previousSessionsData[log.name] = past;
  }
  const previousSessionsJson = JSON.stringify(previousSessionsData);

  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: true,
    temperature: 0.4,
    maxTokens: 2500,
    messages: sessionReportMessages(JSON.stringify(ctx), sessionJson, previousSessionsJson),
  });
  
  if (!chat.ok) return { ok: false, error: chat.error };
  try {
    const jsonStr = extractJson(chat.content);
    const report = aiReportSchema.parse(JSON.parse(jsonStr));
    return { ok: true, report, model: chat.model };
  } catch (e) {
    return { ok: false, error: 'Failed to parse AI report JSON.' };
  }
}

export async function runSkinAsk(
  skin: SkinState,
  settings: AppSettings,
  question: string,
  history: Array<{ role: 'user' | 'ai'; content: string }> = [],
): Promise<{ ok: boolean; answer?: string; model?: string; error?: string; local?: boolean; actions?: string[] }> {
  const q = String(question || '').trim();
  if (q.length < 2) return { ok: false, error: 'Ask a longer question.' };
  if (q.length > 4000) return { ok: false, error: 'Question too long.' };

  const today = new Date().toISOString().slice(0, 10);
  const hints = localSkinAdvice(skin, today);
  const runtime = createSkinToolRuntime();
  const compact = JSON.stringify({
    profile: skin.profile,
    products: skin.products.map((p) => ({
      name: p.name,
      brand: p.brand,
      category: p.category,
      actives: p.actives,
      usedIn: p.usedIn,
      status: p.status,
    })),
    routines: skin.routines.map((r) => ({
      slot: r.slot,
      steps: r.steps.map((s) => ({ label: s.label, linked: Boolean(s.productId), paused: Boolean(s.paused) })),
    })),
    recentLogs: [...skin.logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
  });

  const wantsBuild = /build|make|create|rewrite|set up|setup|plan.*routine|routine.*plan/i.test(q);

  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    if (wantsBuild) {
      const built = applyLocalBuild();
      return {
        ok: true,
        local: true,
        actions: built.actions,
        answer: `I built AM/PM from your shelf (local engine — add an API key in Settings for a smarter plan).\nAM: ${built.am.map((s) => s.product).join(' → ') || 'empty'}\nPM: ${built.pm.map((s) => s.product).join(' → ') || 'empty'}`,
      };
    }
    return { ok: true, answer: hints.map((h) => `• ${h}`).join('\n'), local: true };
  }

  const prior = history.slice(-10).map((m) => ({
    role: (m.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
    content: m.content,
  }));
  const messages = [...skinAskMessages(compact, hints, q)];
  if (prior.length) {
    messages.splice(1, 0, ...prior);
  }

  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.35,
    maxTokens: 1200,
    messages,
    tools: runtime.tools,
    executeTool: runtime.executeTool,
  });
  if (!chat.ok) {
    if (wantsBuild) {
      const built = applyLocalBuild();
      return {
        ok: true,
        local: true,
        error: chat.error,
        actions: built.actions,
        answer: `AI failed (${chat.error}). I still built AM/PM from your shelf.\nAM: ${built.am.map((s) => s.product).join(' → ') || 'empty'}\nPM: ${built.pm.map((s) => s.product).join(' → ') || 'empty'}`,
      };
    }
    return { ok: true, answer: hints.map((h) => `• ${h}`).join('\n'), local: true, error: chat.error };
  }
  const actions = runtime.actions;
  const suffix = actions.length ? `\n\nChanged:\n${actions.map((a) => `• ${a}`).join('\n')}` : '';
  return { ok: true, answer: `${chat.content.trim()}${suffix}`, model: chat.model, actions };
}

export async function runSkinLogReview(
  log: SkinLog,
  settings: AppSettings,
): Promise<{ comment: string; adjustments: string[]; local?: boolean; model?: string; error?: string }> {
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    return { ...applyLocalLogReview(log), local: true };
  }
  const skin = repo.loadSkinState();
  const shelf = {
    products: skin.products.filter((p) => p.status === 'active').map((p) => ({ name: p.name, brand: p.brand, category: p.category, actives: p.actives, usedIn: p.usedIn })),
    routines: skin.routines.map((r) => ({ slot: r.slot, steps: r.steps.map((s) => s.label) })),
  };
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.3,
    maxTokens: 700,
    messages: skinReviewMessages(JSON.stringify(shelf), JSON.stringify(log)),
  });
  if (!chat.ok) {
    return { ...applyLocalLogReview(log), local: true, error: chat.error };
  }
  try {
    const parsed = aiSkinSchema.parse(JSON.parse(extractJson(chat.content))) as {
      comment?: string;
      pauseActives?: boolean;
      resumeActives?: boolean;
      am?: PlannedStepLike[] | null;
      pm?: PlannedStepLike[] | null;
      adjustments?: string[];
    };
    const adjustments = [...(parsed.adjustments || [])];
    if (parsed.pauseActives) {
      const next = pauseActivesInRoutines(skin.routines, skin.products);
      for (const r of next.routines) repo.saveSkinRoutine(r);
      adjustments.push(...next.paused.map((p) => `Paused ${p}`));
    }
    if (parsed.resumeActives && !parsed.pauseActives) {
      const next = resumeActivesInRoutines(skin.routines);
      for (const r of next.routines) repo.saveSkinRoutine(r);
      adjustments.push(...next.resumed.map((p) => `Resumed ${p}`));
    }
    if (Array.isArray(parsed.am) || Array.isArray(parsed.pm)) {
      const result = applyNamedRoutines(parsed.am || undefined, parsed.pm || undefined);
      adjustments.push(...result.actions);
    }
    const comment = String(parsed.comment || 'Log reviewed.');
    repo.saveSkinLog({ ...log, aiComment: comment, aiAdjustments: adjustments });
    return { comment, adjustments, model: chat.model };
  } catch {
    return { ...applyLocalLogReview(log), local: true, error: 'AI review was not valid JSON' };
  }
}

type PlannedStepLike = { product: string; waitMin?: number };

export async function runSkinBuildRoutine(
  settings: AppSettings,
  extra = '',
): Promise<{ ok: boolean; notes?: string; actions?: string[]; local?: boolean; model?: string; error?: string; am?: string[]; pm?: string[] }> {
  const skin = repo.loadSkinState();
  const shelf = skin.products
    .filter((p) => p.status === 'active')
    .map((p) => ({ name: p.name, brand: p.brand, category: p.category, actives: p.actives, usedIn: p.usedIn }));
  if (!shelf.length) {
    return { ok: false, error: 'Add products first. The coach can only build from your shelf.' };
  }
  if (!settings.aiProvider || (!settings.aiApiKey && settings.aiProvider !== 'ollama')) {
    const built = applyLocalBuild();
    return {
      ok: true,
      local: true,
      actions: built.actions,
      am: built.am.map((s) => s.product),
      pm: built.pm.map((s) => s.product),
      notes: 'Built from shelf order (cleanser → treat → moisturize → SPF).',
    };
  }
  const chat = await chatCompletion({
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey,
    model: settings.aiModel || DEFAULT_OPENROUTER_MODEL,
    useFallback: false,
    temperature: 0.3,
    maxTokens: 700,
    messages: skinBuildMessages(JSON.stringify(shelf), extra),
  });
  if (!chat.ok) {
    const built = applyLocalBuild();
    return {
      ok: true,
      local: true,
      error: chat.error,
      actions: built.actions,
      am: built.am.map((s) => s.product),
      pm: built.pm.map((s) => s.product),
      notes: 'AI failed; built from shelf order instead.',
    };
  }
  try {
    const parsed = aiSkinSchema.parse(JSON.parse(extractJson(chat.content))) as {
      am?: PlannedStepLike[];
      pm?: PlannedStepLike[];
      notes?: string;
    };
    const result = applyNamedRoutines(parsed.am || [], parsed.pm || []);
    return {
      ok: true,
      model: chat.model,
      actions: result.actions,
      notes: parsed.notes,
      am: result.am?.steps,
      pm: result.pm?.steps,
    };
  } catch {
    const built = applyLocalBuild();
    return {
      ok: true,
      local: true,
      error: 'AI plan was not valid JSON',
      actions: built.actions,
      am: built.am.map((s) => s.product),
      pm: built.pm.map((s) => s.product),
    };
  }
}

