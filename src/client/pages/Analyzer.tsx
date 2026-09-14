import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../components/Toast';
import { lastNDays, money } from '../lib/utils';

type RangeKey = '7d' | '30d' | '90d' | 'all';

function rangeStart(key: RangeKey): string | null {
  if (key === 'all') return null;
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function Analyzer() {
  const app = useApp();
  const toast = useToast();
  const { analytics, settings, db, setPage } = app;
  const muscleRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef<HTMLCanvasElement>(null);
  const volumeRef = useRef<HTMLCanvasElement>(null);
  const e1rmRef = useRef<HTMLCanvasElement>(null);
  const [range, setRange] = useState<RangeKey>('30d');
  const [plateauAdvice, setPlateauAdvice] = useState<Record<string, string[]>>({});
  const [busyPlateau, setBusyPlateau] = useState<Record<string, boolean>>({});
  const [e1rmExercise, setE1rmExercise] = useState('');
  const [lab, setLab] = useState<{ sessions: number; volume: number; avgReadiness: number | null; readinessPerformanceCorrelation: number | null } | null>(null);
  const [labBusy, setLabBusy] = useState(false);

  const start = rangeStart(range);

  const filtered = useMemo(() => {
    if (!analytics || !db) return null;
    const sessions = db.sessions.filter(
      (s) => s.status === 'finished' && (!start || (s.date || '') >= start),
    );
    let tonnage = 0;
    let completed = 0;
    let skipped = 0;
    const muscleVolume: Record<string, number> = {};
    for (const s of sessions) {
      for (const log of s.logs || []) {
        if (log.status === 'skipped') {
          skipped++;
          continue;
        }
        completed++;
        const lift = (log.sets || []).reduce(
          (sum, set) => sum + (Number(set.w) || 0) * (Number(set.r) || 0),
          0,
        );
        tonnage += lift;
        muscleVolume[log.target || 'Other'] = (muscleVolume[log.target || 'Other'] || 0) + lift;
      }
    }
    const readiness = (analytics.readiness || []).filter((r) => !start || (r.date || '') >= start);
    const weeklyVolume = (analytics.weeklyVolume || []).filter(
      (w) => !start || w.weekStart >= start,
    );
    const recentPrs = (analytics.recentPrs || []).filter((p) => !start || (p.date || '') >= start);
    const calendarDays = lastNDays(range === '7d' ? 28 : range === '30d' ? 35 : 90);
    return {
      sessions: sessions.length,
      tonnage,
      completed,
      skipped,
      completion: completed + skipped ? Math.round((completed / (completed + skipped)) * 100) : 0,
      muscleVolume,
      readiness,
      weeklyVolume,
      recentPrs,
      calendarDays,
    };
  }, [analytics, db, start, range]);

  const e1rmNames = useMemo(() => Object.keys(analytics?.e1rmSeries || {}), [analytics?.e1rmSeries]);

  useEffect(() => {
    if (!e1rmExercise && e1rmNames.length) setE1rmExercise(e1rmNames[0]);
  }, [e1rmNames, e1rmExercise]);

  async function bustPlateau(exercise: string) {
    setBusyPlateau((p) => ({ ...p, [exercise]: true }));
    try {
      const res = await app.api.plateauBuster(exercise);
      if (!res.ok) {
        toast.push(res.error || 'Failed to load advice', 'err');
        return;
      }
      setPlateauAdvice((p) => ({ ...p, [exercise]: res.advice || [] }));
    } catch (e) {
      toast.push((e as Error).message, 'err');
    } finally {
      setBusyPlateau((p) => ({ ...p, [exercise]: false }));
    }
  }

  async function refreshAnalyticsLab() {
    setLabBusy(true);
    try { setLab(await app.api.rebuildAnalyticsLab()); toast.push('Analytics Lab updated from your saved records.', 'ok'); }
    catch (error) { toast.push((error as Error).message, 'err'); }
    finally { setLabBusy(false); }
  }

  useEffect(() => {
    if (!analytics || !filtered) return;
    let charts: Array<{ destroy: () => void }> = [];
    let cancelled = false;
    void (async () => {
      const mod = await import('chart.js/auto');
      if (cancelled) return;
      const Chart = mod.default;

      if (muscleRef.current) {
        charts.push(
          new Chart(muscleRef.current, {
            type: 'bar',
            data: {
              labels: Object.keys(filtered.muscleVolume),
              datasets: [
                {
                  data: Object.values(filtered.muscleVolume),
                  backgroundColor: '#fb7185',
                  borderRadius: 8,
                },
              ],
            },
            options: { plugins: { legend: { display: false } }, responsive: true },
          }),
        );
      }

      if (readyRef.current) {
        charts.push(
          new Chart(readyRef.current, {
            type: 'line',
            data: {
              labels: filtered.readiness.map((r) => r.date),
              datasets: [
                {
                  data: filtered.readiness.map((r) => r.score),
                  borderColor: '#c8f542',
                  backgroundColor: (context: any) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                    gradient.addColorStop(0, 'rgba(200, 245, 66, 0.3)');
                    gradient.addColorStop(1, 'rgba(200, 245, 66, 0.0)');
                    return gradient;
                  },
                  fill: true,
                  tension: 0.4,
                  borderWidth: 4,
                  pointBackgroundColor: '#ffffff',
                  pointBorderColor: '#c8f542',
                  pointBorderWidth: 3,
                  pointRadius: 6,
                  pointHoverRadius: 8,
                },
              ],
            },
            options: {
              plugins: { legend: { display: false } },
              responsive: true,
              scales: {
                x: { grid: { display: false } },
                y: { grid: { color: 'rgba(0,0,0,0.05)', tickLength: 0 }, border: { display: false } }
              }
            },
          }),
        );
      }

      if (volumeRef.current) {
        charts.push(
          new Chart(volumeRef.current, {
            type: 'bar',
            data: {
              labels: filtered.weeklyVolume.map((w) => w.weekStart.slice(5)),
              datasets: [
                {
                  label: 'Tonnage',
                  data: filtered.weeklyVolume.map((w) => Math.round(w.tonnage)),
                  backgroundColor: 'rgba(99,102,241,0.7)',
                  borderRadius: 6,
                },
                {
                  label: 'Sets',
                  data: filtered.weeklyVolume.map((w) => w.sets),
                  backgroundColor: 'rgba(200,245,66,0.6)',
                  borderRadius: 6,
                },
              ],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: true, labels: { color: '#a8b0c0' } } },
            },
          }),
        );
      }

      if (e1rmRef.current && e1rmExercise && analytics.e1rmSeries[e1rmExercise]) {
        const series = analytics.e1rmSeries[e1rmExercise].filter(
          (p) => !start || (p.date || '') >= start,
        );
        charts.push(
          new Chart(e1rmRef.current, {
            type: 'line',
            data: {
              labels: series.map((p) => p.date),
              datasets: [
                {
                  label: 'e1RM',
                  data: series.map((p) => p.e1rm),
                  borderColor: '#ffb894',
                  backgroundColor: (context: any) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                    gradient.addColorStop(0, 'rgba(255, 184, 148, 0.3)');
                    gradient.addColorStop(1, 'rgba(255, 184, 148, 0.0)');
                    return gradient;
                  },
                  fill: true,
                  tension: 0.4,
                  borderWidth: 4,
                  pointBackgroundColor: '#ffffff',
                  pointBorderColor: '#ffb894',
                  pointBorderWidth: 3,
                  pointRadius: 6,
                  pointHoverRadius: 8,
                },
              ],
            },
            options: {
              plugins: { legend: { display: false } },
              responsive: true,
              scales: {
                x: { grid: { display: false } },
                y: { grid: { color: 'rgba(0,0,0,0.05)', tickLength: 0 }, border: { display: false } }
              }
            },
          }),
        );
      }
    })();
    return () => {
      cancelled = true;
      charts.forEach((c) => c.destroy());
      charts = [];
    };
  }, [analytics, filtered, e1rmExercise, start]);

  if (!analytics || !settings || !filtered) return null;

  const cal = analytics.trainingCalendar || {};
  const avgReady =
    filtered.readiness.length > 0
      ? Math.round(
          filtered.readiness.reduce((s, r) => s + (r.score || 0), 0) / filtered.readiness.length,
        )
      : null;

  return (
    <div className="fade page-shell">
      <header className="page-hero">
        <div>
          <span className="page-eyebrow">Analytics</span>
          <h1 className="page-title">Analyzer</h1>
          <p className="page-sub">Volume, PRs, e1RM trends, calendar, and plateaus — all local.</p>
        </div>
        <div className="page-hero-actions">
          <div className="page-tabs">
            {(['7d', '30d', '90d', 'all'] as RangeKey[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`page-tab ${range === r ? 'active' : ''}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="page-signals">
        <div className="page-signal">
          <span className="page-signal-label">Sessions</span>
          <span className="page-signal-value">{filtered.sessions}</span>
        </div>
        <div className="page-signal">
          <span className="page-signal-label">Tonnage</span>
          <span className="page-signal-value" style={{ fontSize: '1.1rem' }}>
            {money(filtered.tonnage, settings.units)}
          </span>
        </div>
        <div className="page-signal">
          <span className="page-signal-label">Completion</span>
          <span className="page-signal-value">{filtered.completion}%</span>
        </div>
        <div className="page-signal">
          <span className="page-signal-label">Streak</span>
          <span className="page-signal-value">{analytics.totals.streak}</span>
        </div>
        {analytics.totals.avgSessionMinutes ? (
          <div className="page-signal">
            <span className="page-signal-label">Avg session</span>
            <span className="page-signal-value">{analytics.totals.avgSessionMinutes}m</span>
          </div>
        ) : null}
      </div>

      <section className="page-panel" aria-label="DuckDB Analytics Lab">
        <div className="toolbar"><div><p className="page-section-label">Analytics Lab</p><h3 style={{ margin: 0 }}>Deep local analysis</h3><p className="subtle" style={{ margin: '6px 0 0' }}>DuckDB rebuilds a read-only analytical mirror from saved workouts. It never changes your records.</p></div><button type="button" className="btn btn-soft" disabled={labBusy} onClick={() => void refreshAnalyticsLab()}>{labBusy ? 'Analysing…' : 'Run analysis'}</button></div>
        {lab && <div className="row" style={{ gap: 18, flexWrap: 'wrap', marginTop: 14 }}><span>{lab.sessions} finished sessions</span><span>{money(lab.volume, settings.units)} analysed volume</span><span>Average readiness: {lab.avgReadiness == null ? '—' : lab.avgReadiness.toFixed(1)}</span><span>Readiness/performance link: {lab.readinessPerformanceCorrelation == null ? 'Need more matched sessions' : lab.readinessPerformanceCorrelation.toFixed(2)}</span></div>}
      </section>

      {analytics.weekCompare ? (
        <div className="grid-2">
          <div className="page-panel">
            <div className="page-panel-head">
              <div>
                <p className="page-section-label">Compare</p>
                <h3>This week</h3>
              </div>
            </div>
            <p className="subtle" style={{ margin: 0 }}>
              {analytics.weekCompare.current.sessions} sessions ·{' '}
              {money(analytics.weekCompare.current.tonnage, settings.units)} ·{' '}
              {analytics.weekCompare.current.sets} sets · PRs {analytics.weekCompare.current.prs}
              {analytics.weekCompare.current.avgReadiness != null
                ? ` · ready ${analytics.weekCompare.current.avgReadiness}`
                : ''}
            </p>
          </div>
          <div className="page-panel">
            <div className="page-panel-head">
              <div>
                <p className="page-section-label">Compare</p>
                <h3>Last week</h3>
              </div>
            </div>
            <p className="subtle" style={{ margin: 0 }}>
              {analytics.weekCompare.previous.sessions} sessions ·{' '}
              {money(analytics.weekCompare.previous.tonnage, settings.units)} ·{' '}
              {analytics.weekCompare.previous.sets} sets · PRs {analytics.weekCompare.previous.prs}
              {analytics.weekCompare.previous.avgReadiness != null
                ? ` · ready ${analytics.weekCompare.previous.avgReadiness}`
                : ''}
            </p>
          </div>
        </div>
      ) : null}

      {analytics.deload ? (
        <div
          className="page-panel"
          style={analytics.deload.recommended ? { borderColor: 'var(--warn)' } : undefined}
        >
          <div className="toolbar">
            <div>
              <span className={`pill ${analytics.deload.recommended ? 'pill-orange' : 'pill-green'}`}>
                {analytics.deload.recommended ? 'Deload recommended' : 'Deload not needed'}
              </span>
              <p className="subtle" style={{ margin: '8px 0 0' }}>
                {analytics.deload.reason}
              </p>
            </div>
            {analytics.deload.recommended ? (
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Programs')}>
                Programs
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {(analytics.imbalanceFlags || []).length > 0 ? (
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Asymmetry</p>
              <h3>L/R imbalance</h3>
            </div>
          </div>
          <div className="page-list">
            {analytics.imbalanceFlags!.map((f) => (
              <div key={f.exercise} className="page-list-item">
                <span>{f.note}</span>
                <span className="subtle">
                  L {f.left} / R {f.right}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="row">
        <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('ExerciseHistory')}>
          Open lift history
        </button>
      </div>

      <div className="page-panel">
        <div className="page-panel-head">
          <div>
            <p className="page-section-label">Consistency</p>
            <h3>Training calendar</h3>
          </div>
          <span className="subtle" style={{ fontSize: 12 }}>
            {Object.keys(cal).length} trained days total
          </span>
        </div>
        <div className="heatmap" style={{ flexWrap: 'wrap', gap: 4 }}>
          {filtered.calendarDays.map((d) => {
            const n = cal[d] || 0;
            return (
              <div
                key={d}
                className={`heat-cell ${n ? 'on' : ''}`}
                title={`${d}${n ? ` · ${n} session(s)` : ''}`}
                style={n > 1 ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}
              />
            );
          })}
        </div>
        <p className="subtle mt-3" style={{ fontSize: 12, marginBottom: 0 }}>
          Highlighted = finished session(s).
        </p>
      </div>

      <div className="grid-2">
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">PRs</p>
              <h3>Recent PRs</h3>
            </div>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Records')}>
              Records
            </button>
          </div>
          <div className="page-list">
            {(filtered.recentPrs.length ? filtered.recentPrs : analytics.recentPrs || [])
              .slice(-12)
              .reverse()
              .map((p, i) => (
                <div key={`${p.exercise}-${p.date}-${i}`} className="page-list-item">
                  <div>
                    <b>{p.exercise}</b>
                    <div className="subtle" style={{ fontSize: 12 }}>
                      {p.date}
                    </div>
                  </div>
                  <span>
                    {p.bestWeight} {settings.units} × {p.bestReps} · e1RM {Math.round(p.bestE1rm)}
                  </span>
                </div>
              ))}
            {!(analytics.recentPrs || []).length ? <div className="page-empty">No recent PRs in range.</div> : null}
          </div>
        </div>
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Lifetime</p>
              <h3>All-time bests</h3>
            </div>
          </div>
          <div className="page-list">
            {(analytics.personalRecords || []).slice(0, 12).map((p) => (
              <div key={p.exercise} className="page-list-item">
                <div>
                  <b>{p.exercise}</b>
                  <div className="subtle" style={{ fontSize: 12 }}>
                    {p.date}
                  </div>
                </div>
                <span>
                  {p.bestWeight} {settings.units} × {p.bestReps} · e1RM {Math.round(p.bestE1rm)}
                </span>
              </div>
            ))}
            {!(analytics.personalRecords || []).length ? (
              <div className="page-empty">Log sessions to unlock PRs.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Volume</p>
              <h3>Muscle volume ({range})</h3>
            </div>
          </div>
          <canvas ref={muscleRef} height={160} />
        </div>
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Recovery</p>
              <h3>Readiness</h3>
            </div>
            {avgReady != null ? <span className="pill pill-cyan">avg {avgReady}</span> : null}
          </div>
          <canvas ref={readyRef} height={160} style={{ filter: 'drop-shadow(0 10px 15px rgba(200, 245, 66, 0.2))' }} />
        </div>
      </div>

      <div className="grid-2">
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Load</p>
              <h3>Weekly volume</h3>
            </div>
          </div>
          <canvas ref={volumeRef} height={160} />
          {!(filtered.weeklyVolume || []).length ? <p className="subtle">Not enough weekly data yet.</p> : null}
        </div>
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Strength</p>
              <h3>e1RM trend</h3>
            </div>
            <select
              className="input"
              style={{ maxWidth: 200 }}
              value={e1rmExercise}
              onChange={(e) => setE1rmExercise(e.target.value)}
            >
              {e1rmNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <canvas ref={e1rmRef} height={160} style={{ filter: 'drop-shadow(0 10px 15px rgba(255, 184, 148, 0.2))' }} />
          {!e1rmNames.length ? <p className="subtle">Need more logged lifts for trends.</p> : null}
        </div>
      </div>

      <div className="page-panel">
        <div className="page-panel-head">
          <div>
            <p className="page-section-label">Leaders</p>
            <h3>Exercise leaders (Epley e1RM)</h3>
          </div>
        </div>
        <div className="page-list">
          {analytics.exerciseLeaders.map((e) => (
            <div key={e.name} className="page-list-item">
              <b>{e.name}</b>
              <span>
                {money(e.tonnage, settings.units)} · 1RM {Math.round(e.best1rm)} {settings.units}
              </span>
            </div>
          ))}
          {!analytics.exerciseLeaders.length ? <div className="page-empty">No data yet.</div> : null}
        </div>
      </div>

      <div className="grid-2">
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Landmarks</p>
              <h3>Weekly set landmarks</h3>
            </div>
          </div>
          <div className="page-list">
            {(analytics.volumeLandmarks || []).map((v) => (
              <div key={v.muscle} className="page-list-item">
                <div>
                  <b>{v.muscle}</b>
                  <div className="subtle">{v.status}</div>
                </div>
                <span>{v.weeklySets} sets</span>
              </div>
            ))}
            {!(analytics.volumeLandmarks || []).length ? (
              <div className="page-empty">Log sessions to see volume.</div>
            ) : null}
          </div>
        </div>
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Stuck lifts</p>
              <h3>Plateau watch</h3>
            </div>
          </div>
          <div className="page-list">
            {(analytics.plateaus || []).map((p) => (
              <div
                key={p.exercise}
                className="page-list-item"
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}
              >
                <div style={{ fontWeight: 800 }}>{p.note}</div>
                {(settings?.hasAiApiKey || settings?.aiProvider === 'ollama') && (
                  <div style={{ width: '100%' }}>
                    {!plateauAdvice[p.exercise] ? (
                      <button
                        className="btn btn-soft btn-sm"
                        disabled={busyPlateau[p.exercise]}
                        onClick={() => bustPlateau(p.exercise)}
                      >
                        {busyPlateau[p.exercise] ? 'Analyzing...' : 'Bust Plateau (AI)'}
                      </button>
                    ) : (
                      <div className="page-ai-strip" style={{ marginTop: 8, flexDirection: 'column', alignItems: 'flex-start' }}>
                        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800 }}>AI Plateau Buster</h4>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.5 }}>
                          {plateauAdvice[p.exercise].map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!(analytics.plateaus || []).length ? (
              <div className="page-empty">No plateaus detected yet.</div>
            ) : null}
          </div>
        </div>
      </div>

      {(analytics.goalProgress || []).length > 0 && (
        <div className="page-panel">
          <div className="page-panel-head">
            <div>
              <p className="page-section-label">Goals</p>
              <h3>Goals snapshot</h3>
            </div>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Targets')}>
              Open Goals
            </button>
          </div>
          <div className="page-list">
            {analytics.goalProgress.map((g) => (
              <div key={g.id} className="page-list-item">
                <div>
                  <b>{g.name}</b>
                  <div className="subtle" style={{ fontSize: 12 }}>
                    {g.current} → {g.target} {g.unit}
                  </div>
                </div>
                <span className={`pill ${g.percent >= 100 ? 'pill-green' : 'pill-slate'}`}>{g.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
