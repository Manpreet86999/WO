import { useEffect, useState, type ReactNode } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import type { WorkoutApiClient } from './lib/api-client';
import { ToastProvider } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { Planner } from './pages/Planner';
import { Tracker } from './pages/Tracker';
import { Records } from './pages/Records';
import { Analyzer } from './pages/Analyzer';
import { Coach } from './pages/Coach';
import { Targets } from './pages/Targets';
import { Body } from './pages/Body';
import { Library } from './pages/Library';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { ExerciseHistory } from './pages/ExerciseHistory';
import { CalendarPage } from './pages/CalendarPage';
import { Programs } from './pages/Programs';
import { SkinOverview } from './pages/skin/Overview';
import { SkinRoutine } from './pages/skin/Routine';
import { SkinProfilePage } from './pages/skin/MySkin';
import { SkinProducts } from './pages/skin/Products';
import { SkinProgress } from './pages/skin/Progress';
import { SkinAi } from './pages/skin/AiCoach';
import { QueueModal } from './components/QueueModal';
import { Onboarding } from './components/Onboarding';
import { UpdatePrompt } from './components/UpdatePrompt';
import { BottomDock, KeyDock } from './components/KeyDock';
import { today } from './lib/utils';
import type { Page } from './lib/types';
import { homeOf, pageLabel } from '../shared/workspaces';
import { latestSkinLog, logForDate, skinStatusScore } from '../shared/skin';
import { APP_VERSION } from '../shared/version';
import { CloudAccountProvider, useCloudAccount } from './state/CloudAccountContext';

function BrandMark() {
  return <div className="mark"><img src="/body-os-logo.png" alt="Body OS" /></div>;
}

function UnlockGate() {
  const { unlock, loading, error } = useApp();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  if (loading) {
    return (
      <div className="unlock-screen">
        <div className="glass card unlock-card text-center">
          <BrandMark />
          <h2 style={{ margin: '12px 0 6px', fontWeight: 800, letterSpacing: '-0.03em' }}>Body OS</h2>
          <p className="subtle">Loading your local body system…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="unlock-screen">
      <form
        className="glass card unlock-card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await unlock(pin);
          } catch (ex) {
            setErr((ex as Error).message);
          }
        }}
      >
        <BrandMark />
        <h2 className="text-center" style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Body OS
        </h2>
        <p className="subtle text-center">Enter your local PIN. Online integrations are optional.</p>
        <input
          className="input"
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="current-password"
        />
        {(err || error) && (
          <p style={{ color: 'var(--danger)', fontWeight: 700, margin: 0, fontSize: 13 }}>{err || error}</p>
        )}
        <button className="btn btn-hot w-full" type="submit">
          Unlock
        </button>
      </form>
    </div>
  );
}

function FeatureGuide() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  const features = [
    { title: 'Body OS', desc: 'One operating system. Workout and Skincare are sibling workspaces — switch them from the command rail.', icon: 'B', color: '#a3e635' },
    { title: 'Workout', desc: 'Your daily hub. Check readiness, view your mission, and start today’s workout.', icon: '◎', color: '#3b82f6' },
    { title: 'Start a workout', desc: 'Use Start Workout from Home. Log each set in Tracker and finish the session to save your progress.', icon: '▶', color: '#f59e0b' },
    { title: 'Skincare', desc: 'Overview, routine, shelf, and barrier logs live in their own workspace. Same OS. Different desk.', icon: '◎', color: '#34d399' },
    { title: 'Planner', desc: 'Build and organize training weeks, days, exercises, volume, and progression targets.', icon: '▦', color: '#f59e0b' },
    { title: 'Progress analytics', desc: 'Analyzer tracks PRs, e1RM, volume, consistency, plateaus, and trends over time.', icon: '◈', color: '#8b5cf6' },
    { title: 'Settings & help', desc: 'Theme, profile, AI, and backup live in the shared OS core — available from the rail footer.', icon: '⚙', color: '#38bdf8' },
    { title: 'Protect your data', desc: 'Backup Health in Settings is where you export local data, manage Google Drive, and restore safely.', icon: '☁', color: '#10b981' },
  ];

  const next = () => {
    if (step === features.length - 1) {
      app.api.saveSettings({ hasSeenFeatureGuide: true } as any).then(() => app.refresh());
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 300);
  };

  const f = features[step];

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999, background: 'rgba(7,8,11,0.95)', display: 'flex' }}>
      <div className="glass card" style={{ width: 500, maxWidth: '90vw', margin: 'auto', textAlign: 'center' }}>
        <div style={{ opacity: animating ? 0 : 1, transform: animating ? 'scale(0.95)' : 'scale(1)', transition: 'all 0.3s ease' }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: f.color }}>{f.icon}</div>
          <h2 style={{ fontSize: 28, margin: '0 0 12px' }}>{f.title}</h2>
          <p className="subtle" style={{ fontSize: 16, lineHeight: 1.5, minHeight: 72 }}>{f.desc}</p>
        </div>
        <div className="row" style={{ marginTop: 32, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {features.map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i === step ? 'var(--brand, var(--accent))' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
          <button className="btn btn-hot" onClick={next}>
            {step === features.length - 1 ? 'Enter Body OS' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleAccountGate() {
  const cloud = useCloudAccount();
  if (cloud.status === 'loading') {
    return <div className="unlock-screen"><div className="glass card unlock-card text-center"><BrandMark /><h2>Body OS</h2><p className="subtle">Checking your Google account…</p></div></div>;
  }
  if (cloud.user) return null;
  return <div className="unlock-screen"><div className="glass card unlock-card stack text-center"><BrandMark /><h2 style={{ margin: 0 }}>Your Body OS workspace</h2><p className="subtle">Continue with Google to open your Training and Care records. Your account keeps ownership clear across web and phone.</p>{cloud.error && <p style={{ color: 'var(--danger)', fontWeight: 700, margin: 0, fontSize: 13 }}>{cloud.error}</p>}<button type="button" className="btn btn-hot w-full" onClick={() => void cloud.signIn()}>Continue with Google</button><p className="subtle" style={{ fontSize: 12, margin: 0 }}>Existing local records are reviewed before their first cloud merge.</p></div></div>;
}

function MigrationGate() {
  const cloud = useCloudAccount();
  if (!cloud.migrationRequired) return null;
  const preview = cloud.migrationPreview;
  return <div className="unlock-screen"><div className="glass card unlock-card stack text-center"><BrandMark /><h2 style={{ margin: 0 }}>Review your first sync</h2><p className="subtle">Body OS found {preview?.localRecords ?? 'your'} local record{preview?.localRecords === 1 ? '' : 's'} and {preview?.remoteRecords ?? 'your'} cloud record{preview?.remoteRecords === 1 ? '' : 's'}. It will compare them before making any change.</p><p className="subtle">Conflicting edits are shown for your decision. Your data is never silently replaced.</p><button type="button" className="btn btn-hot w-full" disabled={!preview} onClick={() => void cloud.approveMigration()}>Review & start secure sync</button></div></div>;
}

function Shell() {
  const app = useApp();
  const cloud = useCloudAccount();
  const {
    page,
    setPage,
    workspace,
    setWorkspace,
    db,
    analytics,
    skin,
    activeDay,
    theme,
    toggleTheme,
    unlocked,
    needsPin,
    loading,
    error,
    setTracker,
    settings,
  } = app;
  const [dockHover, setDockHover] = useState(false);
  const [dockPinned, setDockPinned] = useState(() => localStorage.getItem('body-os-dock-pinned') === '1');
  const [showWhatsNew, setShowWhatsNew] = useState(() => localStorage.getItem('body-os-whatsnew-v450') !== '1');

  const dockOpen = dockPinned || dockHover;

  useEffect(() => {
    localStorage.setItem('body-os-dock-pinned', dockPinned ? '1' : '0');
  }, [dockPinned]);

  if (loading) {
    return (
      <div className="unlock-screen">
        <div className="glass card unlock-card text-center">
          <BrandMark />
          <h2 style={{ margin: '12px 0 6px', fontWeight: 800 }}>Body OS</h2>
          <p className="subtle">Starting local engine…</p>
        </div>
      </div>
    );
  }
  if (needsPin && !unlocked) return <UnlockGate />;
  if (unlocked && !cloud.user) return <GoogleAccountGate />;
  if (unlocked && cloud.migrationRequired) return <MigrationGate />;
  if (error || !db || !analytics) {
    return (
      <div className="shell">
        <div className="glass card">
          <h2 style={{ color: 'var(--danger)', marginTop: 0 }}>Couldn’t load Body OS</h2>
          <p className="subtle">{error || 'Unknown error'}</p>
          <p className="subtle">
            Run <code className="mono">npm start</code> then hard-refresh (Ctrl+Shift+R).
          </p>
        </div>
      </div>
    );
  }

  const week = db.weeks.find((w) => w.id === db.meta.activeWeekId) || db.weeks[0];
  const day = week.days.find((d) => d.key === activeDay) || week.days[0];
  const ready = db.readiness.find((r) => r.date === today());
  const record = db.sessions.find((s) => s.weekId === week.id && s.dayKey === day.key && s.status === 'finished');
  const lastSkin = latestSkinLog(skin.logs);
  const todaySkin = logForDate(skin.logs, today());
  const skinScore = skinStatusScore(lastSkin);

  const pages: Record<Page, ReactNode> = {
    Dashboard: <Dashboard />,
    Planner: <Planner />,
    Tracker: <Tracker />,
    Records: <Records />,
    Analyzer: <Analyzer />,
    Coach: <Coach />,
    Targets: <Targets />,
    Body: <Body />,
    Library: <Library />,
    Reports: <Reports />,
    Settings: <Settings />,
    ExerciseHistory: <ExerciseHistory />,
    Calendar: <CalendarPage />,
    Programs: <Programs />,
    SkinOverview: <SkinOverview />,
    SkinRoutine: <SkinRoutine />,
    SkinProfile: <SkinProfilePage />,
    SkinProducts: <SkinProducts />,
    SkinProgress: <SkinProgress />,
    SkinAi: <SkinAi />,
  };

  function startFab() {
    if (record) {
      setPage('Records');
      return;
    }
    if (!ready) {
      setPage('Dashboard');
      return;
    }
    if (!day.exercises.length) {
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
      name: settings?.profileName || db!.profile?.displayName || 'Athlete',
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

  const title = page === 'Dashboard' ? 'Home' : pageLabel(page);
  const subtitle =
    page === 'Settings'
      ? 'Shared OS core · profile, theme, AI, backup'
      : workspace === 'skincare'
        ? todaySkin
          ? `Barrier ${todaySkin.barrier} · Hydration ${todaySkin.hydration} · ${todaySkin.routineDone.am ? 'AM logged' : 'AM open'} · ${todaySkin.routineDone.pm ? 'PM logged' : 'PM open'}`
          : lastSkin
            ? `Last log ${lastSkin.date} · status ${skinScore ?? '—'}`
            : 'No skin log yet'
        : `${day.key} · ${day.title} · ${week.name}`;

  return (
    <div className={`app-frame ${dockOpen ? 'dock-open' : ''} ${dockPinned ? 'dock-pinned' : ''} ws-${workspace}`}>
      {!settings?.isActivated && <Onboarding />}
      {settings?.isActivated && !settings?.hasSeenFeatureGuide && <FeatureGuide />}
      <QueueModal />
      <UpdatePrompt />

      <KeyDock expanded={dockOpen} onHoverChange={setDockHover} />

      <div className="main-col">
        <header className="topbar">
          <div className="row" style={{ gap: 12, minWidth: 0 }}>
            <button
              type="button"
              className="icon-btn desktop-collapse-toggle"
              onClick={() => setDockPinned((v) => !v)}
              title={dockPinned ? 'Unpin command rail' : 'Pin command rail'}
              aria-label={dockPinned ? 'Unpin command rail' : 'Pin command rail'}
            >
              {dockPinned ? '«' : '☰'}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPage(homeOf(workspace))}
              title="Workspace home"
              aria-label="Workspace home"
            >
              ‹
            </button>
            <div className="ws-switch mobile-ws" role="tablist" aria-label="Workspace">
              <button
                type="button"
                className={workspace === 'workout' ? 'active' : ''}
                onClick={() => setWorkspace('workout')}
              >
                Workout
              </button>
              <button
                type="button"
                className={workspace === 'skincare' ? 'active' : ''}
                onClick={() => setWorkspace('skincare')}
              >
                Skincare (Beta)
              </button>
            </div>
            <div style={{ minWidth: 0 }}>
              <h2>{title}</h2>
              <p className="subtle">{subtitle}</p>
            </div>
          </div>
          <div className="top-actions">
            {workspace === 'skincare' ? (
              <div className={`chip ${todaySkin ? 'ready-ok' : ''}`}>
                {todaySkin ? `Status ${skinScore ?? '—'}` : 'Log skin status'}
              </div>
            ) : (
              <div className={`chip ${ready ? 'ready-ok' : ''}`}>
                {ready ? `Estimated readiness ${ready.score}` : 'Log readiness'}
              </div>
            )}
            {workspace === 'workout' ? (
              <div className="chip streak">
                <span aria-hidden>🔥</span>
                {analytics.totals.streak} streak
              </div>
            ) : null}
            <button type="button" className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
              {theme === 'dark' ? '☾' : '☀'}
            </button>
          </div>
        </header>

        <main className="shell">
          {showWhatsNew ? (
            <div className="whats-new fade">
              <div>
                <h3>Body OS v{APP_VERSION} — A calmer space. A stronger routine.</h3>
                <ul>
                  <li>Swipe through readiness and workout cards, with clear progress and saved drafts.</li>
                  <li>Review your answers before saving. Go back at any point without losing your entries.</li>
                  <li>A refreshed daily workspace. Local use is free; cloud integrations are optional.</li>
                </ul>
              </div>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={() => {
                  localStorage.setItem('body-os-whatsnew-v450', '1');
                  setShowWhatsNew(false);
                }}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {pages[page] ?? pages[homeOf(workspace)]}
        </main>
      </div>

      {page !== 'Tracker' && workspace === 'workout' ? (
        <button type="button" className="fab" onClick={startFab}>
          ▶ {record ? 'View record' : ready ? 'Start workout' : 'Log readiness'}
        </button>
      ) : null}

      <BottomDock />
    </div>
  );
}

export default function App({ apiClient }: { apiClient: WorkoutApiClient }) {
  return (
    <ToastProvider>
      <AppProvider apiClient={apiClient}>
        <CloudAccountProvider><Shell /></CloudAccountProvider>
      </AppProvider>
    </ToastProvider>
  );
}
