import { queryClient } from '../lib/query-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setAuthToken, getAuthToken } from '../lib/api';
import type { WorkoutApiClient } from '../lib/api-client';
import type {
  AppDb,
  Bootstrap,
  CoachResult,
  Metrics,
  Page,
  PublicSettings,
  TrackerState,
} from '../lib/types';
import { localDayKey } from '../lib/utils';
import { useToast } from '../components/Toast';
import { emptySkinState, type SkinState } from '../../shared/skin';
import { homeOf, isPage, workspaceOf, type WorkspaceId } from '../../shared/workspaces';

const WS_KEY = 'body-os-workspace';
const LAST_WORKOUT_KEY = 'body-os-last-workout-page';
const LAST_SKIN_KEY = 'body-os-last-skin-page';

function readWorkspace(): WorkspaceId {
  return localStorage.getItem(WS_KEY) === 'skincare' ? 'skincare' : 'workout';
}

function readLastPage(key: string, fallback: Page): Page {
  try {
    const raw = localStorage.getItem(key);
    return isPage(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

interface AppState {
  page: Page;
  setPage: (p: Page) => void;
  workspace: WorkspaceId;
  setWorkspace: (w: WorkspaceId) => void;
  skin: SkinState;
  refreshSkin: () => Promise<void>;
  db: AppDb | null;
  settings: PublicSettings | null;
  analytics: Metrics | null;
  coach: CoachResult | null;
  setCoach: (c: CoachResult | null) => void;
  programming: Bootstrap['programming'];
  urls: Bootstrap['urls'] | null;
  activeDay: string;
  setActiveDay: (d: string) => void;
  manualDay: boolean;
  setManualDay: (v: boolean) => void;
  draftStatus: 'saved' | 'saving' | 'error' | 'empty';
  tracker: TrackerState | null;
  setTracker: (t: TrackerState | null) => void;
  lastSessionId: string | null;
  setLastSessionId: (id: string | null) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  refresh: () => Promise<void>;
  needsPin: boolean;
  unlocked: boolean;
  unlock: (pin: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  api: WorkoutApiClient;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children, apiClient }: { children: ReactNode; apiClient: WorkoutApiClient }) {
  const toast = useToast();
  const [workspace, setWorkspaceState] = useState<WorkspaceId>(readWorkspace);
  const [page, setPageState] = useState<Page>(() =>
    readWorkspace() === 'skincare'
      ? readLastPage(LAST_SKIN_KEY, 'SkinAi')
      : readLastPage(LAST_WORKOUT_KEY, 'Dashboard'),
  );
  const [skin, setSkin] = useState<SkinState>(emptySkinState);
  const [db, setDb] = useState<AppDb | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [analytics, setAnalytics] = useState<Metrics | null>(null);
  const [coach, setCoach] = useState<CoachResult | null>(null);
  const [programming, setProgramming] = useState<Bootstrap['programming']>(null);
  const [urls, setUrls] = useState<Bootstrap['urls'] | null>(null);
  const [activeDay, setActiveDay] = useState(localDayKey());
  const [manualDay, setManualDay] = useState(false);
  const [tracker, setTrackerState] = useState<TrackerState | null>(() => {
    try {
      const raw = localStorage.getItem('body-os-tracker-draft') || localStorage.getItem('powerpulse-tracker-draft');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as TrackerState;
      return { ...parsed, id: parsed.id || crypto.randomUUID() };
    } catch {
      return null;
    }
  });
  const setTracker = useCallback((value: TrackerState | null) => setTrackerState(value ? {...value, id: value.id || crypto.randomUUID()} : null), []);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'error' | 'empty'>('empty');
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('body-os-theme') || localStorage.getItem('powerpulse-theme')) as 'light' | 'dark' || 'light',
  );
  const [needsPin, setNeedsPin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('body-os-theme', theme);
  }, [theme]);

  useEffect(() => {
    setDraftStatus('saving');
    try {
      if (tracker) localStorage.setItem('body-os-tracker-draft', JSON.stringify(tracker));
      else {
        localStorage.removeItem('body-os-tracker-draft');
        localStorage.removeItem('powerpulse-tracker-draft');
      }
      setDraftStatus(tracker ? 'saved' : 'empty');
    } catch { setDraftStatus('error'); }

  }, [tracker]);

  const applyBootstrap = useCallback((b: Bootstrap) => {
    setDb(b.db);
    if (b.skin) setSkin(b.skin);
    else if (b.db.skin) setSkin(b.db.skin);
    setSettings(b.settings);
    setAnalytics(b.analytics);
    setCoach(b.coach);
    setProgramming(b.programming);
    setUrls(b.urls);
    if (!manualDay) {
      const weeks = b?.db?.weeks ?? [];
      const metaActiveWeekId = b?.db?.meta?.activeWeekId;
      const week = Array.isArray(weeks) && weeks.length > 0 ? (weeks.find((w) => w.id === metaActiveWeekId) || weeks[0]) : null;
      const dayKey = week?.days?.find((d) => d.key === localDayKey())?.key || week?.days?.[0]?.key || localDayKey();
      setActiveDay(dayKey);
    }
  }, [manualDay]);

  const refresh = useCallback(async () => {
    const b = await queryClient.fetchQuery({ queryKey: ['bootstrap'], queryFn: () => apiClient.bootstrap() });
    applyBootstrap(b);
  }, [applyBootstrap, apiClient]);

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await apiClient.authStatus();
      if (status.hasPin && !getAuthToken()) {
        setNeedsPin(true);
        setUnlocked(false);
        setLoading(false);
        return;
      }
      if (!status.hasPin) setAuthToken('');
      await refresh();
      setUnlocked(true);
      setNeedsPin(status.hasPin);
    } catch (e) {
      const err = e as Error & { code?: string; status?: number };
      if (err.status === 401 || err.code === 'PIN_REQUIRED') {
        setNeedsPin(true);
        setUnlocked(false);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const unlock = useCallback(
    async (pin: string) => {
      const res = await apiClient.authUnlock(pin);
      setAuthToken(res.token);
      await refresh();
      setUnlocked(true);
      setNeedsPin(true);
      toast.push('Unlocked', 'ok');
    },
    [refresh, toast],
  );

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const refreshSkin = useCallback(async () => {
    const next = await queryClient.fetchQuery({ queryKey: ['skin'], queryFn: () => apiClient.getSkin() });
    setSkin(next);
  }, [apiClient]);

  const setPage = useCallback((p: Page) => {
    const ws = workspaceOf(p);
    if (ws !== 'system') {
      setWorkspaceState(ws);
      localStorage.setItem(WS_KEY, ws);
      if (ws === 'skincare') localStorage.setItem(LAST_SKIN_KEY, p);
      else localStorage.setItem(LAST_WORKOUT_KEY, p);
    }
    setPageState(p);
  }, []);

  const setWorkspace = useCallback((w: WorkspaceId) => {
    setWorkspaceState(w);
    localStorage.setItem(WS_KEY, w);
    const next =
      w === 'skincare'
        ? readLastPage(LAST_SKIN_KEY, homeOf('skincare'))
        : readLastPage(LAST_WORKOUT_KEY, homeOf('workout'));
    setPageState(next);
  }, []);

  const value = useMemo(
    () => ({
      page,
      setPage,
      workspace,
      setWorkspace,
      skin,
      refreshSkin,
      db,
      settings,
      analytics,
      coach,
      setCoach,
      programming,
      urls,
      activeDay,
      setActiveDay,
      manualDay,
      setManualDay,
      draftStatus,
      tracker,
      setTracker,
      lastSessionId,
      setLastSessionId,
      theme,
      toggleTheme,
      refresh,
      needsPin,
      unlocked,
      unlock,
      loading,
      error,
      api: apiClient,
    }),
    [
      page,
      setPage,
      workspace,
      setWorkspace,
      skin,
      refreshSkin,
      db,
      settings,
      analytics,
      coach,
      programming,
      urls,
      activeDay,
      manualDay,
      draftStatus,
      tracker,
      lastSessionId,
      theme,
      toggleTheme,
      refresh,
      needsPin,
      unlocked,
      unlock,
      loading,
      error,
      apiClient,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
