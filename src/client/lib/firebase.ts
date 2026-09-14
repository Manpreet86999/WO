import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { bodyOsFirebaseConfig } from '../../shared/firebase-config';

const appName = 'body-os-web';

/** One named Firebase client for account access and record synchronisation. */
export function bodyOsFirebaseApp() {
  return getApps().find((app) => app.name === appName) || initializeApp(bodyOsFirebaseConfig, appName);
}

export function bodyOsAuth() {
  return getAuth(bodyOsFirebaseApp());
}

let firestore: Firestore | null = null;

/** IndexedDB cache keeps the owner-scoped record feed readable offline. */
export function bodyOsFirestore() {
  if (!firestore) firestore = initializeFirestore(bodyOsFirebaseApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return firestore;
}
