import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { bodyOsFirebaseConfig } from '../../shared/firebase-config';
import { canonical, contentToken, type CloudRecord, type SyncChoice } from '../../shared/cloud';
import { syncRecordsFromDb, type SyncRecord } from '../../shared/sync';
import { post } from '../lib/api';
import { bodyOsAuth, bodyOsFirestore } from '../lib/firebase';
import { useApp } from './AppContext';

export type CloudStatus = 'loading' | 'signed-out' | 'saved' | 'syncing' | 'offline' | 'pending' | 'needs-review' | 'error';

type SyncResult = { uploaded: number; downloaded: number; conflicts: { key: string; local: SyncRecord; remote: CloudRecord }[] };

interface CloudAccountState {
  user: User | null;
  status: CloudStatus;
  error: string | null;
  result: SyncResult | null;
  choices: Record<string, SyncChoice>;
  migrationRequired: boolean;
  migrationPreview: { localRecords: number; remoteRecords: number; upload: number; download: number; conflicts: number } | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  choose: (key: string, choice: SyncChoice | null) => void;
  approveMigration: () => Promise<void>;
}

const CloudAccount = createContext<CloudAccountState | null>(null);
const CHANGE_EVENT = 'body-os-record-changed';

function syncSignature(records: SyncRecord[]) {
  return canonical(records.map(({ id, entityType, payload, revision, deletedAt }) => ({ id, entityType, payload, revision, deletedAt })));
}

/**
 * Owns the one Google identity used by every Body OS workspace. It also turns
 * successful Training/Care mutations into a debounced, conflict-safe cloud sync.
 */
export function CloudAccountProvider({ children }: { children: ReactNode }) {
  const { db, refresh } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<CloudStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [choices, setChoices] = useState<Record<string, SyncChoice>>({});
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState<CloudAccountState['migrationPreview']>(null);
  const pendingChange = useRef(false);
  const syncing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSignature = useRef('');

  const runSync = useCallback(async () => {
    const current = bodyOsAuth().currentUser;
    if (!current || !db || syncing.current) return;
    if (!navigator.onLine) {
      pendingChange.current = true;
      setStatus('offline');
      return;
    }
    if (migrationRequired || Object.keys(choices).length) {
      setStatus('needs-review');
      return;
    }
    syncing.current = true;
    setError(null);
    setStatus('syncing');
    try {
      const next = await post<SyncResult>('/api/cloud-sync/run', {
        ...bodyOsFirebaseConfig,
        idToken: await current.getIdToken(),
        deviceId: 'web',
        choices,
      });
      setResult(next);
      pendingChange.current = false;
      if (next.conflicts.length) setStatus('needs-review');
      else {
        setStatus('saved');
        await refresh();
      }
    } catch (cause) {
      pendingChange.current = true;
      const message = (cause as Error).message || 'Sync failed. Local changes are safe on this device.';
      setError(message);
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      syncing.current = false;
    }
  }, [choices, db, refresh]);

  const schedule = useCallback(() => {
    if (!bodyOsAuth().currentUser || !db || migrationRequired || Object.keys(choices).length) return;
    pendingChange.current = true;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    setStatus('pending');
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      void runSync();
    }, 1200);
  }, [choices, db, migrationRequired, runSync]);

  useEffect(() => onAuthStateChanged(bodyOsAuth(), (next) => {
    setUser(next);
    setError(null);
    setResult(null);
    setChoices({});
    setMigrationPreview(null);
    pendingChange.current = false;
    setMigrationRequired(false);
    setStatus(next ? 'pending' : 'signed-out');
  }), []);

  const signature = db ? syncSignature(syncRecordsFromDb(db, 'web')) : '';
  useEffect(() => {
    if (!user || !db) return;
    const ledgerKey = `body-os-migration/${user.uid}`;
    if (!localStorage.getItem(ledgerKey)) {
      if (migrationRequired) return;
      let alive = true;
      void (async () => {
        try {
          const preview = await post<{ localRecords: number; remoteRecords: number; upload: number; download: number; conflicts: unknown[] }>('/api/cloud-sync/preview', {
            ...bodyOsFirebaseConfig, idToken: await user.getIdToken(), deviceId: 'web',
          });
          if (!alive) return;
          setMigrationPreview({ ...preview, conflicts: preview.conflicts.length });
          setMigrationRequired(true);
          setStatus('needs-review');
        } catch (cause) {
          if (!alive) return;
          setError((cause as Error).message || 'Could not prepare the first sync review.');
          setStatus('error');
        }
      })();
      return () => { alive = false; };
    }
    if (migrationRequired) return;
    if (signature !== lastSignature.current) {
      lastSignature.current = signature;
      schedule();
    }
  }, [db, migrationRequired, schedule, signature, user]);

  useEffect(() => {
    const onChange = () => schedule();
    const onOnline = () => schedule();
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('online', onOnline);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule]);

  useEffect(() => {
    if (!user) return;
    let initial = true;
    // This listener is deliberately limited to the signed-in owner's records.
    // Firestore rules reject any other account before data reaches this cache.
    return onSnapshot(collection(bodyOsFirestore(), 'users', user.uid, 'records'), (snapshot) => {
      if (initial) { initial = false; return; }
      if (snapshot.docChanges().some((change) => !change.doc.metadata.hasPendingWrites)) schedule();
    }, (cause) => {
      setError((cause as Error).message || 'Live record updates are unavailable.');
    });
  }, [schedule, user]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(bodyOsAuth(), new GoogleAuthProvider());
    } catch (cause) {
      setError((cause as Error).message || 'Google sign-in did not finish.');
      setStatus('signed-out');
    }
  }, []);

  const signOutAccount = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await signOut(bodyOsAuth());
  }, []);

  const choose = useCallback((key: string, choice: SyncChoice | null) => {
    setChoices((current) => {
      const next = { ...current };
      if (choice) next[key] = choice;
      else delete next[key];
      return next;
    });
  }, []);

  const syncNow = useCallback(async () => {
    await runSync();
  }, [runSync]);

  const approveMigration = useCallback(async () => {
    if (!user) return;
    localStorage.setItem(`body-os-migration/${user.uid}`, JSON.stringify({ approvedAt: new Date().toISOString(), source: 'legacy-browser', preview: migrationPreview }));
    setMigrationRequired(false);
    setStatus('pending');
    pendingChange.current = true;
  }, [migrationPreview, user]);

  const value = useMemo(() => ({ user, status, error, result, choices, migrationRequired, migrationPreview, signIn, signOut: signOutAccount, syncNow, choose, approveMigration }), [approveMigration, choose, choices, error, migrationPreview, migrationRequired, result, signIn, signOutAccount, status, syncNow, user]);
  return <CloudAccount.Provider value={value}>{children}</CloudAccount.Provider>;
}

export function useCloudAccount() {
  const context = useContext(CloudAccount);
  if (!context) throw new Error('useCloudAccount must be used inside CloudAccountProvider.');
  return context;
}

export function resolveConflictChoice(conflict: SyncResult['conflicts'][number], side: 'local' | 'remote'): SyncChoice {
  return { side, cloudVersion: conflict.remote.cloudVersion || '', localToken: contentToken(conflict.local) };
}
