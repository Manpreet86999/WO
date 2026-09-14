import { Router } from 'express';
import * as repo from '../db/repository.js';
import { id } from '../lib/ids.js';
import type { Session } from '../../shared/types.js';

/** Week lifecycle and plan-editing endpoints. Mounted after API authentication. */
export const programmingRouter = Router();

programmingRouter.get('/weeks', (_req, res) => {
  const data = repo.loadAppDb();
  res.json({ activeWeekId: data.meta.activeWeekId, weeks: data.weeks });
});

programmingRouter.post('/weeks/import', (req, res) => {
  try {
    const week = repo.upsertWeek({ ...req.body, id: req.body.id || id('week') });
    repo.logEvent('week.import', { id: week.id });
    res.json(week);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Import failed' });
  }
});

programmingRouter.post('/weeks/:weekId/activate', (req, res) => {
  const week = repo.getWeek(req.params.weekId);
  if (!week) return res.status(404).json({ error: 'Week not found.' });
  if (repo.getTrainingConfig().preplannedWeekMode === false && week.mode !== 'flexible') {
    return res.status(409).json({ error: 'Preplanned Week is off. Only the current flexible training week can be active.' });
  }
  repo.setActiveWeekId(week.id);
  res.json({ ok: true });
});

programmingRouter.post('/weeks/:weekId/duplicate', (req, res) => {
  const week = repo.getWeek(req.params.weekId);
  if (!week) return res.status(404).json({ error: 'Week not found.' });
  const copy = JSON.parse(JSON.stringify(week));
  copy.id = id('week');
  copy.name += ' Copy';
  copy.active = false;
  res.json(repo.upsertWeek(copy));
});

programmingRouter.put('/weeks/:weekId', (req, res) => {
  try {
    const existing = repo.getWeek(req.params.weekId);
    if (!existing) return res.status(404).json({ error: 'Week not found.' });
    res.json(repo.upsertWeek(repo.mergeWeekUpdate(existing, req.body || {})));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Update failed' });
  }
});

programmingRouter.delete('/weeks/:weekId', (req, res) => {
  try {
    repo.deleteWeek(req.params.weekId);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Delete failed' });
  }
});

programmingRouter.post('/weeks/:weekId/complete', (req, res) => {
  const data = repo.loadAppDb();
  const week = data.weeks.find((item) => item.id === req.params.weekId);
  if (!week) return res.status(404).json({ error: 'Week not found.' });
  const completedDays = new Set(
    data.sessions.filter((session) => session.weekId === week.id && session.status === 'finished').map((session) => session.dayKey),
  );
  const profile = repo.getProfile();
  const createdAt = new Date().toISOString();
  const date = createdAt.slice(0, 10);
  for (const day of week.days.filter((item) => item.type !== 'rest')) {
    if (completedDays.has(day.key)) continue;
    const session: Session = {
      id: id('session'), status: 'finished', createdAt, weekId: week.id, weekName: week.name || '',
      weekNumber: week.weekNumber || '', dayKey: day.key, dayTitle: day.title || '', date,
      name: String(req.body?.name || profile.displayName), sleep: '', soreness: '', logs: [], completedByLibrary: true,
    };
    repo.saveSession(session);
  }
  res.json({ ok: true });
});
