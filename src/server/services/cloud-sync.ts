import { readCloud, writeCloud } from '../../shared/cloud.js';
import type { AppDb } from '../../shared/types.js';
import { resolveSyncRecord, syncKey, syncRecordsFromDb, type SyncConflict, type SyncRecord } from '../../shared/sync.js';

export interface FirebaseSyncConfig { apiKey: string; projectId: string; }
export interface FirebaseSession { uid: string; idToken: string; }

/** Verify the Firebase-issued token with Firebase, never trust a client-supplied UID. */
export async function firebaseSessionFromToken(config:FirebaseSyncConfig,idToken:string):Promise<FirebaseSession> {
  let claims:{aud?:string;iss?:string};
  try {claims=JSON.parse(Buffer.from(idToken.split('.')[1],'base64url').toString('utf8'));}
  catch {throw new Error('Invalid Firebase session. Sign in again.');}
  if(claims.aud!==config.projectId||claims.iss!==`https://securetoken.google.com/${config.projectId}`)throw new Error('The Google session belongs to another Firebase project.');
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken}),signal:AbortSignal.timeout(30000),
  });
  if(!response.ok)throw new Error('Firebase could not verify this session. Sign in again.');
  const data=await response.json() as {users?:{localId:string;disabled?:boolean}[]};
  const user=data.users?.[0];if(!user?.localId||user.disabled)throw new Error('This Firebase account is unavailable.');
  return {uid:user.localId,idToken};
}

export async function firebaseSignIn(config: FirebaseSyncConfig, email: string, password: string): Promise<FirebaseSession> {
  if (!config.apiKey || !config.projectId) throw new Error('Firebase API key and project ID are required.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error('Firebase sign-in failed.');
  const data = await response.json() as { localId: string; idToken: string };
  return { uid: data.localId, idToken: data.idToken };
}

export const listFirebaseRecords = readCloud;
export async function pushFirebaseRecords(config: FirebaseSyncConfig, session: FirebaseSession, records: SyncRecord[]): Promise<void> {
  for (const record of records) await writeCloud(config, session, record);
}

export async function previewCloudSync(db: AppDb, config: FirebaseSyncConfig, session: FirebaseSession, deviceId: string) {
  const [remote, local] = await Promise.all([listFirebaseRecords(config, session), Promise.resolve(syncRecordsFromDb(db, deviceId))]);
  const remoteByKey = new Map(remote.map((record) => [syncKey(record), record]));
  const conflicts: SyncConflict[] = [];
  let upload = 0;
  let download = 0;
  for (const record of local) {
    const resolution = resolveSyncRecord(record, remoteByKey.get(syncKey(record)), false);
    if (resolution?.kind === 'use-local') upload++;
    if (resolution?.kind === 'conflict') conflicts.push(resolution.conflict);
  }
  for (const record of remote) if (!local.some((item) => syncKey(item) === syncKey(record))) download++;
  return { localRecords: local.length, remoteRecords: remote.length, upload, download, conflicts };
}
