import { ReadinessCards } from '../components/ReadinessCards';
import { HealthReadings } from '../components/HealthReadings';
import { EmptyState, ScorePill, ScoreRing, Stat } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useToast } from '../components/Toast';
import { greeting, lastNDays, money, readyTone, today, weekStatus } from '../lib/utils';
import type { Readiness } from '../lib/types';
import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../components/Modal';

function dashboardWeek(db: any) {
  const active = db.weeks.find((week: any) => week.id === db.meta.activeWeekId) || db.weeks[0];
  if (db.trainingConfig?.preplannedWeekMode !== false) return active;
  const date = today();
  return db.weeks.find((week: any) => week.mode === 'flexible' && week.status === 'draft' && week.flexibleStartDate <= date && week.flexibleEndDate >= date) || active;
}

export function Dashboard() {
  const app = useApp();
  const toast = useToast();
  const { db, analytics, coach, programming, activeDay, setActiveDay, setManualDay, setPage, setTracker, settings } = app;
  const [editReady, setEditReady] = useState(false);
  const [brief, setBrief] = useState('');
  const [briefModel, setBriefModel] = useState('');
  const [busyBrief, setBusyBrief] = useState(false);
  const [missionInput, setMissionInput] = useState('');
  const [missionDismissed,setMissionDismissed]=useState(false);
  const [readinessForm, setReadinessForm] = useState<any>({});
  const [flexWeekName, setFlexWeekName] = useState('');
  const [pendingReports, setPendingReports] = useState<Array<{ sessionId: string; attempts: number; lastError: string }>>([]);

  useEffect(() => { void fetch('/api/reports/pending').then((response) => response.ok ? response.json() : { reports: [] }).then((data) => setPendingReports(data.reports || [])).catch(() => {}); }, []);

  useEffect(() => {
    if (app.db && app.settings) {
      const w = dashboardWeek(app.db);
      const readyDay = w.mode === 'flexible' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].find((key) => w.dayStates?.[key]?.status === 'ready') : undefined;
      const d = w.days.find((d: any) => d.key === (readyDay || activeDay)) || w.days[0];
      const r = app.db.readiness.find((x) => x.weekId === w.id && x.dayKey === d.key);
      if (r) {
        setReadinessForm({
          sleepHours: r.sleepHours, sleepQuality: r.sleepQuality, steps: r.steps,
          soreness: r.soreness, energy: r.energy, stress: r.stress, motivation: r.motivation,
          mood: r.mood, hydration: r.hydration, mealProtein: r.mealProtein,
          painFlag: String(r.painFlag), restingHeartRate: r.restingHeartRate, notes: r.notes
        });
      } else {
        setReadinessForm({});
      }
    }
  }, [activeDay, app.db, app.settings, editReady]);

  if (!db || !analytics || !coach || !settings) return null;

  const plannedWeek = db.weeks.find((w) => w.id === db.meta.activeWeekId) || db.weeks[0];
  const flexibleMode = db.trainingConfig?.preplannedWeekMode === false;
  const flexibleWeek = flexibleMode ? db.weeks.find((item) => item.mode === 'flexible' && item.status === 'draft' && item.flexibleStartDate && item.flexibleEndDate && item.flexibleStartDate <= today() && item.flexibleEndDate >= today()) : undefined;
  const scheduledFlexibleWeek = flexibleMode ? db.weeks.find((item) => item.mode === 'flexible' && item.status === 'draft' && item.flexibleStartDate && item.flexibleStartDate > today()) : undefined;
  const week = flexibleWeek || plannedWeek;
  const flexibleActiveDay = flexibleWeek ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].find((key) => flexibleWeek.dayStates?.[key]?.status === 'ready') : undefined;
  const day = week.days.find((d) => d.key === (flexibleActiveDay || activeDay)) || week.days[0];
  const ready = db.readiness.find((r) => r.weekId === week.id && r.dayKey === day.key);
  const doneThisWeek = db.sessions.filter((s) => s.weekId === week.id && s.status === 'finished').length;
  const status = flexibleWeek ? (() => { const states = Object.values(flexibleWeek.dayStates || {}) as Array<any>; const total = states.filter((item) => item.status !== 'not_in_week').length; const done = states.filter((item) => item.status === 'workout' || item.status === 'rest').length; return { total, done, complete: total > 0 && total === done }; })() : weekStatus(week, db.sessions);
  const record = db.sessions.find(
    (s) => s.weekId === week.id && s.dayKey === day.key && s.status === 'finished',
  );
  const nextWeek =
    db.weeks.find((x) => Number(x.weekNumber || 0) === Number(week.weekNumber || 0) + 1) || null;
  const name = settings.profileName || db.profile?.displayName || 'athlete';

  const latestPr = (analytics.recentPrs || [])[(analytics.recentPrs?.length || 0) - 1];
  const nearestGoal = (analytics.goalProgress || [])
    .filter((g) => g.deadline && g.status !== 'completed')
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))[0];
  const weekPct = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;
  const isRestDay = day.type === 'rest' && !day.exercises.length;
  const readinessPending = !ready || editReady;
  const dayIndex = week.days.findIndex((item) => item.key === day.key);
  const nextTrainingDay = [...week.days.slice(dayIndex + 1), ...week.days.slice(0, dayIndex)]
    .find((item) => item.type !== 'rest' || item.exercises.length > 0);
  const ctaLabel = record ? 'Open record' : ready ? 'Start session' : 'Log readiness';
  const isAiEnabled = settings.hasAiApiKey || settings.aiProvider === 'ollama';

  async function retryReports() {
    try {
      const response = await fetch('/api/reports/pending/retry', { method: 'POST' });
      const data = await response.json();
      const failed = (data.results || []).filter((item: any) => !item.ok).length;
      setPendingReports(failed ? await fetch('/api/reports/pending').then((r) => r.json()).then((x) => x.reports || []) : []);
      toast.push(failed ? `${failed} report(s) still need attention.` : 'Pending AI reports sent.', failed ? 'info' : 'ok');
    } catch (error) { toast.push(error instanceof Error ? error.message : 'Could not retry reports.', 'err'); }
  }

  async function saveReadiness(values: Record<string, any>) {
    const fd = {get: (key: string) => values[key]};
    try {
      await app.api.saveReadiness({
        id: ready?.id || crypto.randomUUID(),
        weekId: week.id,
        dayKey: day.key,
        date: today(),
        sleepHours: fd.get('sleepHours'),
        sleepQuality: fd.get('sleepQuality'),
        steps: fd.get('steps'),
        soreness: fd.get('soreness'),
        energy: fd.get('energy'),
        stress: fd.get('stress'),
        motivation: fd.get('motivation'),
        mood: fd.get('mood'),
        hydration: 0,
        mealProtein: 0,
        painFlag: fd.get('painFlag'),
        restingHeartRate: fd.get('restingHeartRate'),
        notes: fd.get('notes'),
      });
      await app.refresh();
      setEditReady(false);
      toast.push(`Readiness saved for ${day.key} — training unlocked`, 'ok');
    } catch (err) {
      toast.push((err as Error).message, 'err');
      throw err;
    }
  }

  function startTracker() {
    if (!db) return;
    if (record) {
      toast.push('Day already saved — open Records', 'info');
      setPage('Records');
      return;
    }

    if (!ready) {
      toast.push('Complete readiness first', 'err');
      return;
    }
    if (flexibleWeek) {
      setTracker({ weekId: flexibleWeek.id, weekName: flexibleWeek.name, weekNumber: flexibleWeek.weekNumber, dayKey: day.key, dayTitle: 'Flexible workout', date: today(), name, sleep: ready.sleepHours, soreness: ready.soreness, readiness: ready, index: 0, logs: [], exercises: [], startedAt: new Date().toISOString(), gymMode: localStorage.getItem('workout-os-gym-mode') === '1', mode: 'flexible', targetMuscles: [] });
      setPage('Tracker');
      return;
    }
    if (!day.exercises.length) {
      toast.push('Add exercises in Planner first', 'err');
      setPage('Planner');
      return;
    }
    setTracker({
      weekId: week.id,
      weekName: week.name,
      weekNumber: week.weekNumber,
      dayKey: day.key,
      dayTitle: day.title,
      date: today(),
      name,
      sleep: ready.sleepHours,
      soreness: ready.soreness,
      readiness: ready,
      index: 0,
      logs: [],
      exercises: JSON.parse(JSON.stringify(day.exercises)),
      startedAt: new Date().toISOString(),
      gymMode: localStorage.getItem('workout-os-gym-mode') === '1',
    });
    setPage('Tracker');
  }

  if (flexibleWeek && status.complete) {
    const workouts = Object.values(flexibleWeek.dayStates || {}).filter((state: any) => state.status === 'workout').length;
    const rests = Object.values(flexibleWeek.dayStates || {}).filter((state: any) => state.status === 'rest').length;
    return <div className="fade dash"><section className="dash-panel flexible-start-card stack"><span className="dash-eyebrow">Flexible week complete</span><h2>Great work — your week is ready to save.</h2><p className="subtle">{workouts} workouts · {rests} rest days. Your session history is already saved. Give this reusable Program a name.</p><input className="input" autoFocus value={flexWeekName} onChange={(event) => setFlexWeekName(event.target.value)} placeholder="e.g. September strength week"/><button className="btn btn-hot" onClick={async () => { try { await app.api.completeFlexibleWeek(flexibleWeek.id, flexWeekName); await app.refresh(); toast.push('Week saved to Programs.', 'ok'); setPage('Programs'); } catch (error) { toast.push((error as Error).message, 'err'); } }}>Save week to Programs</button></section></div>;
  }

  async function importGoogleFitReadiness() {
    const response = await fetch('/api/google-fit/sync?preview=true', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Google Fit could not provide readiness data.');
    const metrics = result.dailyMetrics?.[today()] || {};
    const values = {
      sleepHours: metrics.sleepHours ? String(Math.round(Number(metrics.sleepHours) * 10) / 10) : '',
      restingHeartRate: metrics.hrCount ? String(Math.round(Number(metrics.hrSum || 0) / Number(metrics.hrCount))) : '',
      steps: metrics.steps ? String(Math.round(Number(metrics.steps))) : '',
    };
    if (!Object.values(values).some(Boolean)) throw new Error('No sleep, heart-rate, or step data was available from Google Fit for today.');
    const labels = [values.sleepHours && 'sleep', values.restingHeartRate && 'heart rate', values.steps && 'steps'].filter(Boolean) as string[];
    toast.push('Google Fit readings added. Review them, then finish your check-in.', 'ok');
    return { values, labels };
  }

  if (flexibleMode && !flexibleWeek && scheduledFlexibleWeek) {
    return <div className="fade dash"><section className="dash-panel flexible-start-card stack"><span className="dash-eyebrow">Flexible training</span><h2>Your new week is scheduled.</h2><p className="subtle">Flexible logging begins on {scheduledFlexibleWeek.flexibleStartDate}. Until then, your imported plan and past records remain available in Programs and Records.</p><button className="btn btn-soft" onClick={() => setPage('Programs')}>Open Programs</button></section></div>;
  }

  if (flexibleMode && !flexibleWeek) {
    const isMonday = new Date(`${today()}T12:00:00`).getDay() === 1;
    return <div className="fade dash"><section className="dash-panel flexible-start-card stack"><span className="dash-eyebrow">Flexible training</span><h2>{isMonday ? 'Ready for a new week?' : 'Your next flexible week starts Monday.'}</h2><p className="subtle">Every flexible week follows a Monday–Sunday sequence and becomes a reusable Program when complete.</p>{isMonday ? <button className="btn btn-hot" onClick={async () => { try { await app.api.startFlexibleWeek('monday'); await app.refresh(); toast.push('New flexible week started.', 'ok'); } catch (error) { toast.push((error as Error).message, 'err'); } }}>Start new week</button> : <button className="btn btn-soft" onClick={() => setPage('Settings')}>Choose a different start</button>}</section></div>;
  }

  if (status.complete && !nextWeek && !flexibleWeek) {
    return (
      <div className="fade dash">
        <EmptyState
          title={`${week.name} is complete`}
          body="Import your next training week in Library to start the next block."
          action={
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn btn-hot" type="button" onClick={() => setPage('Library')}>
                Open Library
              </button>
              <button className="btn btn-soft" type="button" onClick={() => setPage('Records')}>
                View Records
              </button>
            </div>
          }
        />
      </div>
    );
  }

  async function loadBriefing() {
    setBusyBrief(true);
    try {
      const res = await app.api.morningBrief();
      if (!res.ok) {
        toast.push(res.error || 'Failed to load brief', 'err');
        return;
      }
      setBrief(res.brief || '');
      setBriefModel(res.model || '');
    } catch (e) {
      toast.push((e as Error).message, 'err');
    } finally {
      setBusyBrief(false);
    }
  }

  const morningBriefing = isAiEnabled ? (
    <section className="dash-panel dash-ai">
      <div className="dash-ai-glow" aria-hidden />
      <div className="dash-panel-head">
        <div className="dash-ai-title">
          <span className="dash-ai-badge">AI</span>
          <div>
            <h3>Morning briefing</h3>
            <p className="subtle" style={{ margin: 0 }}>Personalized focus from readiness & history</p>
          </div>
        </div>
        {!brief && (
          <button className="btn btn-hot btn-sm" disabled={busyBrief} onClick={() => void loadBriefing()}>
            {busyBrief ? 'Generating…' : 'Generate brief'}
          </button>
        )}
      </div>
      {brief ? (
        <div className="dash-ai-body">
          <p>{brief}</p>
          <span className="dash-ai-model">Model · {briefModel}</span>
        </div>
      ) : (
        <p className="subtle dash-ai-placeholder">
          Generate a short coach note tailored to how you feel and what you&apos;ve been training.
        </p>
      )}
    </section>
  ) : null;

  return (
    <div className="fade dash">
      {pendingReports.length ? <section className="dash-panel" style={{ borderColor: 'var(--warn, #eab308)' }}><div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><span className="dash-eyebrow">REPORT DELIVERY NEEDS ATTENTION</span><h3 style={{ margin: '4px 0' }}>{pendingReports.length} AI report{pendingReports.length === 1 ? '' : 's'} waiting</h3><p className="subtle" style={{ margin: 0 }}>Your workouts are saved. {pendingReports[0]?.lastError}</p></div><button type="button" className="btn btn-hot" onClick={() => void retryReports()}>Retry reports</button></div></section> : null}
      <HealthReadings />
      <Modal
        open={!week.missionObjective && !missionDismissed}
        title="Weekly Mission Objective"
        onClose={() => setMissionDismissed(true)}
        actions={
          <button
            type="button"
            className="btn btn-hot"
            onClick={async () => {
              if (!missionInput.trim()) {
                toast.push('Mission Objective is required.', 'err');
                return;
              }
              try {
                await app.api.saveWeek(week.id, { ...week, missionObjective: missionInput.trim() });
                await app.refresh();
                toast.push('Weekly focus saved.', 'ok');
              } catch (e) {
                toast.push((e as Error).message, 'err');
              }
            }}
          >
            Save focus
          </button>
        }
      >
        <div className="stack">
          <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>
            Choose a focus for this week, or come back to it later.
          </p>
          <button type="button" className="btn btn-soft" onClick={()=>setMissionDismissed(true)}>Not now</button>
          <input
            className="input"
            placeholder="e.g. Complete three training sessions"
            value={missionInput}
            onChange={(e) => setMissionInput(e.target.value)}
          />
        </div>
      </Modal>

      {/* ── Welcome Hero ── */}
      <section className="dash-hero">
        <div className="dash-hero-orbs" aria-hidden>
          <span className="dash-orb dash-orb-a" />
          <span className="dash-orb dash-orb-b" />
          <span className="dash-orb dash-orb-c" />
        </div>
        <div className="dash-hero-grid" aria-hidden />

        <div className="dash-hero-top">
          <div className="dash-status-row">
            <span className="dash-live">
              <span className="dash-live-dot" />
              System online
            </span>
            <span className="dash-chip muted">
              {week.name}{week.weekNumber ? ` · W${week.weekNumber}` : ''}
            </span>
            {ready ? (
              <span className={`dash-chip tone-${readyTone(ready)}`}>
                Estimated readiness {ready.score}
              </span>
            ) : isRestDay ? (
              <span className="dash-chip muted">Rest day</span>
            ) : (
              <span className="dash-chip warn">Readiness pending</span>
            )}
          </div>

          <div className="dash-hero-actions">
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Calendar')}>
              Calendar
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Targets')}>
              Goals
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Analyzer')}>
              PRs
            </button>
          </div>
        </div>

        <div className="dash-hero-body">
          <div className="dash-hero-copy">
            <p className="dash-kicker">{greeting()}</p>
            <h2 className="dash-title">
              Welcome back, <span className="dash-name">{name}</span>
            </h2>
            {week.missionObjective ? (
              <div className="dash-mission">
                <span className="dash-mission-label">Mission</span>
                <span className="dash-mission-text">{week.missionObjective}</span>
              </div>
            ) : null}
            <p className="dash-sub">
              Today is <strong>{day.title}</strong>
              {day.subtitle ? ` — ${day.subtitle}` : '. Show up. Execute. Log it.'}
            </p>
            <div className="dash-cta-row">
              <button type="button" className="btn btn-hot btn-xl dash-cta-primary" onClick={startTracker}>
                <span className="dash-cta-icon" aria-hidden>▶</span>
                {ctaLabel}
              </button>
              <button type="button" className="btn btn-soft btn-lg" onClick={() => setPage('Planner')}>
                Edit plan
              </button>
            </div>
          </div>

          <div className="dash-hero-panel">
            <div className="dash-ring-wrap">
              <div className="dash-week-ring" style={{ ['--p' as string]: weekPct }}>
                <div className="dash-week-ring-inner">
                  <span className="dash-week-pct">{weekPct}%</span>
                  <span className="dash-week-label">week</span>
                </div>
              </div>
            </div>
            <div className="dash-hero-panel-meta">
              <div>
                <span className="subtle">Sessions</span>
                <strong>{doneThisWeek} this week</strong>
              </div>
              <div>
                <span className="subtle">Planned</span>
                <strong>{day.exercises.length} moves</strong>
              </div>
              <div>
                <span className="subtle">Status</span>
                <strong>{record ? 'Logged' : isRestDay ? 'Rest' : ready ? 'Unlocked' : 'Gate open'}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {status.complete && nextWeek ? (
        <div className="dash-alert success">
          <div>
            <span className="pill pill-green">Week complete</span>
            <h3>{week.name} is done</h3>
            <p className="subtle">{nextWeek.name} is ready in Library.</p>
          </div>
          <button
            className="btn btn-hot"
            type="button"
            onClick={async () => {
              await app.api.activateWeek(nextWeek.id);
              await app.refresh();
              toast.push('Next week activated', 'ok');
            }}
          >
            Activate next week
          </button>
        </div>
      ) : null}

      {analytics.deload?.recommended ? (
        <div className="dash-alert warn">
          <div>
            <span className="pill pill-orange">Deload signal</span>
            <h3>{analytics.deload.reason}</h3>
            <p className="subtle">{(analytics.deload.actions || []).join(' · ')}</p>
          </div>
          <button
            type="button"
            className="btn btn-hot btn-sm"
            onClick={async () => {
              try {
                await app.api.createDeloadWeek(week.id, analytics.deload?.volumeMultiplier || 0.6);
                await app.refresh();
                toast.push('Deload week created in Library', 'ok');
                setPage('Library');
              } catch (e) {
                toast.push((e as Error).message, 'err');
              }
            }}
          >
            Build deload week
          </button>
        </div>
      ) : null}

      {/* ── Signal strip ── */}
      <section className="dash-signals">
        <article className="dash-signal">
          <div className="dash-signal-icon accent">⚡</div>
          <div>
            <span className="dash-signal-label">Streak</span>
            <strong className="dash-signal-value">{analytics.totals.streak}</strong>
            <span className="dash-signal-sub">training days</span>
          </div>
        </article>
        <article className="dash-signal">
          <div className="dash-signal-icon peach">◎</div>
          <div>
            <span className="dash-signal-label">Completion</span>
            <strong className="dash-signal-value">{analytics.totals.completion}%</strong>
            <span className="dash-signal-sub">done vs skipped</span>
          </div>
        </article>
        <article className="dash-signal">
          <div className="dash-signal-icon blue">◉</div>
          <div>
            <span className="dash-signal-label">Tonnage</span>
            <strong className="dash-signal-value">{money(analytics.totals.tonnage, settings.units)}</strong>
            <span className="dash-signal-sub">lifetime</span>
          </div>
        </article>
        <article className="dash-signal">
          <div className="dash-signal-icon green">★</div>
          <div>
            <span className="dash-signal-label">Latest PR</span>
            <strong className="dash-signal-value dash-signal-value-sm">
              {latestPr ? latestPr.exercise : '—'}
            </strong>
            <span className="dash-signal-sub">{latestPr ? 'recent best' : 'no PR yet'}</span>
          </div>
        </article>
      </section>

      {/* ── Main command grid ── */}
      <section className="dash-main">
        {/* Session board */}
        <div className="dash-panel dash-session">
          <div className="dash-panel-head">
            <div>
              <span className="dash-eyebrow">Today&apos;s session</span>
              <h3>{day.key} · {day.title}</h3>
              <p className="subtle">{day.subtitle || 'Session template ready when you are.'}</p>
            </div>
            <ScorePill r={ready} />
          </div>

          <div className="dash-day-tabs">
            {week.days.map((x) => {
              const finished = db.sessions.some(
                (s) => s.weekId === week.id && s.dayKey === x.key && s.status === 'finished',
              );
              return (
                <button
                  key={x.key}
                  type="button"
                  className={`dash-day-tab ${activeDay === x.key ? 'active' : ''} ${finished ? 'done' : ''}`}
                  onClick={() => {
                    setActiveDay(x.key);
                    setManualDay(true);
                  }}
                >
                  <span>{x.key}</span>
                  {finished ? <span className="dash-day-dot" /> : null}
                </button>
              );
            })}
          </div>

          <div className="dash-ex-list">
            {!flexibleWeek ? <>
            {day.exercises.slice(0, 6).map((e, i) => (
              <div key={e.name} className="dash-ex-row">
                <span className="dash-ex-idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="dash-ex-name">{e.name}</span>
                <span className="dash-ex-vol mono">{e.vol}</span>
              </div>
            ))}
            {!day.exercises.length ? (
              <div className="dash-empty-inline">
                <p className="subtle" style={{ margin: 0 }}>
                  {isRestDay
                    ? 'Rest day — recover, hydrate, or log light cardio in Records.'
                    : 'No exercises yet — open Planner to build today.'}
                </p>
                {!isRestDay ? (
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Planner')}>
                    Open Planner
                  </button>
                ) : null}
              </div>
            ) : null}
            {day.exercises.length > 6 ? (
              <p className="subtle dash-more">+{day.exercises.length - 6} more in full session</p>
            ) : null}
            </> : null}
            {flexibleWeek ? <div className="dash-empty-inline"><p className="subtle" style={{ margin: 0 }}>After readiness, start today&apos;s tracker. Choose muscles and exercises inside the tracker — no Planner required.</p><button className="btn btn-hot btn-sm" onClick={startTracker}>Start today&apos;s tracker</button></div> : null}
          </div>

          <div className="dash-readiness-context" aria-label="Today at a glance">
              <div className="dash-context-heading">
                <div>
                  <span className="dash-eyebrow">Today at a glance</span>
                  <h4>{readinessPending ? (isRestDay ? 'Recovery is the work today' : 'Set the tone before training') : (isRestDay ? 'Recovery is the work today' : 'Your plan is ready')}</h4>
                </div>
                <span className="dash-context-step">{readinessPending ? 'Check-in open' : ready ? 'Readiness saved' : 'Plan ready'}</span>
              </div>
              <div className="dash-context-grid">
                <article className="dash-context-card">
                  <span className="dash-context-icon" aria-hidden>{isRestDay ? '◔' : '◉'}</span>
                  <div>
                    <strong>{isRestDay ? 'No session scheduled' : `${day.exercises.length} moves planned`}</strong>
                    <p>{readinessPending ? (isRestDay ? 'Finish the check-in for a personal recovery recommendation.' : 'Your readiness check-in tailors today’s recommendation.') : (isRestDay ? 'Use your saved recommendation to guide a lighter day.' : 'Your saved check-in has unlocked today’s session.')}</p>
                  </div>
                </article>
                <article className="dash-context-card">
                  <span className="dash-context-icon accent" aria-hidden>↗</span>
                  <div>
                    <strong>{weekPct}% of this week complete</strong>
                    <p>{nextTrainingDay ? `Up next: ${nextTrainingDay.key} · ${nextTrainingDay.title}` : 'Complete this week, then choose your next block.'}</p>
                  </div>
                </article>
              </div>
            </div>

          <div className="dash-day-summary" aria-label="Today plan summary">
            <div><span>Week progress</span><strong>{weekPct}%</strong></div>
            <div><span>Sessions done</span><strong>{doneThisWeek} / {status.total}</strong></div>
            <div><span>Today</span><strong>{record ? 'Logged' : isRestDay ? 'Recover' : ready ? 'Unlocked' : 'Check in'}</strong></div>
          </div>

          {morningBriefing ? (
            <div className="dash-ai-in-context">{morningBriefing}</div>
          ) : null}
        </div>

        {/* Readiness / start column */}
        <div className="dash-side-stack">
          {readinessPending ? (
            <ReadinessCards key={`${week.id}:${day.key}:${ready?.updatedAt||''}`} initial={ready || readinessForm} draftKey={`body-os-readiness-v4:${week.id}:${day.key}:${today()}`} onSave={saveReadiness} onGoogleFitImport={settings.hasGoogleFit ? importGoogleFitReadiness : undefined} />
          ) : (
            <ReadinessAssistant ready={ready} onEdit={() => setEditReady(true)} onStart={startTracker} />
          )}

          {programming ? (
            <div className="dash-panel dash-prog">
              <span className="dash-eyebrow">Programming</span>
              <p className="dash-prog-value">Volume ×{programming.volumeMultiplier.toFixed(2)}</p>
              <p className="subtle" style={{ margin: 0 }}>{programming.intensityNote}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Secondary grid ── */}
      <section className="dash-secondary">
        <div className="dash-panel">
          <div className="dash-panel-head compact">
            <div>
              <span className="dash-eyebrow">Consistency</span>
              <h3>14-day heat</h3>
            </div>
            <span className="dash-meta-chip">{doneThisWeek} this week</span>
          </div>
          <div className="heatmap dash-heatmap" title="Trained days">
            {lastNDays(14).map((d) => {
              const on = db.sessions.some((s) => s.date === d && s.status === 'finished');
              return (
                <div
                  key={d}
                  className={`heat-cell ${on ? 'on' : ''} ${d === today() ? 'today' : ''}`}
                  title={d}
                />
              );
            })}
          </div>
          <p className="subtle dash-heat-hint">Lime = finished session · outline = today</p>
        </div>

        {db.habits.filter((h) => h.active).length > 0 ? (
          <div className="dash-panel">
            <div className="dash-panel-head compact">
              <div>
                <span className="dash-eyebrow">Habits</span>
                <h3>Today&apos;s targets</h3>
              </div>
            </div>
            <div className="dash-habit-list">
              {db.habits.filter((h) => h.active).map((h) => {
                const todayLog = db.habitLogs.find((l) => l.habitId === h.id && l.date === today());
                const isDone = todayLog && todayLog.value >= h.target;
                return (
                  <div key={h.id} className={`dash-habit ${isDone ? 'done' : ''}`}>
                    <div>
                      <strong>{h.name}</strong>
                      <span className="subtle">Target {h.target} {h.unit}</span>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm ${isDone ? 'btn-good' : 'btn-soft'}`}
                      onClick={async () => {
                        try {
                          await app.api.saveHabitLog({
                            id: todayLog ? todayLog.id : crypto.randomUUID(),
                            habitId: h.id,
                            date: today(),
                            value: isDone ? 0 : h.target
                          });
                          await app.refresh();
                          toast.push(isDone ? 'Habit undone' : 'Habit logged!', 'ok');
                        } catch (e) {
                          toast.push((e as Error).message, 'err');
                        }
                      }}
                    >
                      {isDone ? 'Done ✓' : 'Log'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="dash-panel dash-goal-card">
            <div className="dash-panel-head compact">
              <div>
                <span className="dash-eyebrow">Focus</span>
                <h3>Nearest goal</h3>
              </div>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Targets')}>
                Goals
              </button>
            </div>
            {nearestGoal ? (
              <div className="dash-goal-body">
                <strong>{nearestGoal.name}</strong>
                <span className="subtle">Deadline · {nearestGoal.deadline}</span>
              </div>
            ) : (
              <p className="subtle" style={{ margin: 0 }}>
                No active deadline — set a strength or body target to stay locked in.
              </p>
            )}
          </div>
        )}

        <div className="dash-panel">
          <div className="dash-panel-head compact">
            <div>
              <span className="dash-eyebrow">Coach pulse</span>
              <h3>Signals</h3>
            </div>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Coach')}>
              Coach
            </button>
          </div>
          <div className="dash-coach-list">
            {(coach.advice || []).slice(0, 3).map((x) => (
              <div key={x} className="dash-coach-item">{x}</div>
            ))}
            {!(coach.advice || []).length ? (
              <p className="subtle" style={{ margin: 0 }}>Log a session for smarter tips.</p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Sunday review */}
      {new Date().getDay() === 0 && !db.weeklyReviews.some((r) => r.weekStart === db.weeks[0]?.startDate) && (
        <section className="dash-panel dash-review">
          <div className="dash-panel-head">
            <div>
              <span className="dash-eyebrow accent">Sunday routine</span>
              <h3>Weekly review</h3>
              <p className="subtle">Reflect on the past week and plan adjustments.</p>
            </div>
          </div>
          <form
            className="dash-review-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              try {
                await app.api.saveWeeklyReview({
                  id: crypto.randomUUID(),
                  weekStart: week.startDate || today(),
                  wins: (form.elements.namedItem('wins') as HTMLInputElement).value,
                  blockers: (form.elements.namedItem('blockers') as HTMLInputElement).value,
                  adjustment: (form.elements.namedItem('adjustment') as HTMLInputElement).value,
                });
                await app.refresh();
                toast.push('Weekly review saved!', 'ok');
              } catch (err) {
                toast.push((err as Error).message, 'err');
              }
            }}
          >
            <textarea required name="wins" className="input" placeholder="What went well? (Wins)" rows={2} />
            <textarea required name="blockers" className="input" placeholder="What held you back? (Blockers)" rows={2} />
            <textarea required name="adjustment" className="input" placeholder="What will you adjust next week?" rows={2} />
            <button type="submit" className="btn btn-hot">Save review</button>
          </form>
        </section>
      )}

      {/* Quick dock */}
      <section className="dash-dock">
        {([
          { p: 'Planner' as const, label: 'Planner', icon: '▦' },
          { p: 'Library' as const, label: 'Library', icon: '▣' },
          { p: 'Analyzer' as const, label: 'Analyze', icon: '◈' },
          { p: 'ExerciseHistory' as const, label: 'History', icon: '↗' },
          { p: 'Body' as const, label: 'Body', icon: '◌' },
          { p: 'Settings' as const, label: 'Settings', icon: '⚙' },
        ]).map((item) => (
          <button key={item.p} type="button" className="dash-dock-item" onClick={() => setPage(item.p)}>
            <span className="dash-dock-ico">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </section>


    </div>
  );
}

function ReadinessAssistant({
  ready,
  onEdit,
  onStart,
}: {
  ready: Readiness;
  onEdit: () => void;
  onStart: () => void;
}) {
  const a = ready.assistant || {
    reason: 'Readiness saved',
    intensity: ready.recommendation,
    warmup: 'Ramp up gradually',
    recovery: 'Protect sleep and hydration',
  };
  return (
    <div className="dash-panel dash-ready-card">
      <div className="dash-ready-hero">
        <div><ScoreRing score={ready.score} /><small>Estimated · {ready.evidence?.version || 'legacy formula'}</small></div>
        <div>
          <span className={`pill pill-${readyTone(ready)}`}>Today assistant</span>
          <h3>{ready.band}</h3>
          <p className="subtle">{ready.recommendation}</p>
        </div>
        <button type="button" className="btn btn-soft btn-sm dash-ready-edit" onClick={onEdit}>
          Edit
        </button>
      </div>
      <div className="dash-ready-grid-stats">
        <Stat label="Why" value={<span className="dash-stat-text">{a.reason}</span>} />
        <Stat label="Intensity" value={<span className="dash-stat-text">{a.intensity}</span>} />
        <Stat label="Warm-up" value={<span className="dash-stat-text">{a.warmup}</span>} />
        <Stat label="Recovery" value={<span className="dash-stat-text">{a.recovery}</span>} />
      </div>
      <button type="button" className="btn btn-hot btn-xl w-full" onClick={onStart}>
        Start today&apos;s tracker
      </button>
    </div>
  );
}

