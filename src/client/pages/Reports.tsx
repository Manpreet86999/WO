import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { useToast } from '../components/Toast';
import { getAuthToken } from '../lib/api';
import { today } from '../lib/utils';

export function Reports() {
  const app = useApp();
  const toast = useToast();
  const { db, settings, analytics } = app;
  const [weekId, setWeekId] = useState(db?.meta.activeWeekId || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today());

  if (!db || !settings) return null;

  const flexibleMode = db.trainingConfig?.preplannedWeekMode === false;
  const reportWeeks = flexibleMode
    ? db.weeks.filter((week) => week.mode === 'flexible')
    : db.weeks.filter((week) => week.id === db.meta.activeWeekId && week.mode !== 'flexible' && week.status !== 'program');
  const selected = reportWeeks.some((week) => week.id === weekId) ? weekId : (reportWeeks[0]?.id || '');
  const sessions = db.sessions
    .filter((s) => s.weekId === selected && s.status === 'finished')
    .sort((a, b) => (a.dayKey || '').localeCompare(b.dayKey || ''));

  async function downloadHtml(url: string, filename: string) {
    try {
      toast.push('Downloading HTML...', 'info');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error('Failed to generate HTML');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.push('Downloaded!', 'ok');
    } catch (e) {
      toast.push((e as Error).message, 'err');
    }
  }

  async function sendWeeklyTelegram() {
    try {
      toast.push('Sending to Telegram...', 'info');
      const res = await fetch('/api/telegram/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ weekId: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Telegram send failed');
      toast.push('Weekly report sent to Telegram', 'ok');
    } catch (e) {
      toast.push((e as Error).message, 'err');
    }
  }

  return (
    <div className="fade page-shell">
      <header className="page-hero">
        <div>
          <span className="page-eyebrow">Exports</span>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Daily, weekly, and progress HTMLs — generated on this machine.</p>
        </div>
        <div className="page-hero-actions">
          <select
            className="input"
            style={{ maxWidth: 280 }}
            value={selected}
            onChange={(e) => setWeekId(e.target.value)}
          >
            {reportWeeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.weekNumber ? ` · Week ${w.weekNumber}` : ''}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="page-panel">
        <div className="page-panel-head">
          <div>
            <p className="page-section-label">Data dump</p>
            <h3>CSV export</h3>
            <p className="subtle" style={{ margin: '4px 0 0' }}>
              Full session and measurement dumps for spreadsheets.
            </p>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => downloadHtml('/api/export/csv', 'workout-os-sessions.csv')}
            >
              Sessions CSV
            </button>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => downloadHtml('/api/export/measurements.csv', 'workout-os-measurements.csv')}
            >
              Measurements CSV
            </button>
          </div>
        </div>
      </div>

      <div className="page-panel stack">
        <div className="page-panel-head">
          <div>
            <p className="page-section-label">Lifetime</p>
            <h3>Progress report</h3>
            <p className="subtle" style={{ margin: '4px 0 0' }}>
              PRs, goals, body deltas
              {analytics
                ? ` · ${analytics.totals.sessions} lifetime sessions · ${analytics.recentPrs?.length || 0} recent PRs`
                : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-hot"
            onClick={() => {
              const q = new URLSearchParams();
              if (from) q.set('from', from);
              if (to) q.set('to', to);
              const qs = q.toString();
              void downloadHtml(
                `/api/reports/progress/html${qs ? `?${qs}` : ''}`,
                `progress-report${from || to ? `-${from || 'start'}-${to || 'end'}` : ''}.html`,
              );
            }}
          >
            Download Progress HTML
          </button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <label className="subtle" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            From
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="subtle" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            To
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => { setFrom(''); setTo(today()); }}>
            Clear range (all time)
          </button>
        </div>
      </div>

      <div className="page-panel">
        <div className="page-panel-head">
          <div>
            <p className="page-section-label">Week rollup</p>
            <h3>Weekly report</h3>
            <p className="subtle" style={{ margin: '4px 0 0' }}>
              Merges finished sessions for the selected week.
            </p>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-hot"
              disabled={!selected}
              onClick={() => downloadHtml(`/api/reports/week/${selected}/html`, `weekly-report-${selected}.html`)}
            >
              Download Full Week HTML
            </button>
            {settings.hasTelegramBot ? (
              <button type="button" className="btn btn-soft" onClick={() => void sendWeeklyTelegram()}>
                Send Telegram
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <p className="page-section-label">Daily reports</p>
        <div className="page-list">
          {sessions.map((s) => {
            const done = (s.logs || []).filter((l) => l.status !== 'skipped').length;
            return (
              <div key={s.id} className="page-list-item">
                <div>
                  <span className="pill pill-slate mr-2">{s.dayKey}</span>
                  <span className="pill pill-green mr-2">{s.date}</span>
                  <div style={{ fontWeight: 900, marginTop: 8 }}>{s.dayTitle || 'Saved record'}</div>
                  <div className="subtle mt-1">
                    {s.name} · {done} exercises
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() =>
                    downloadHtml(`/api/reports/session/${s.id}/html`, `daily-report-${s.date}.html`)
                  }
                >
                  Download Daily HTML
                </button>
              </div>
            );
          })}
          {!sessions.length ? (
            <div className="page-empty">
              No finished sessions in this week yet. Complete a workout in Tracker, then return here.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
