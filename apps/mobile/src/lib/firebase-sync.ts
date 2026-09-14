import * as SecureStore from 'expo-secure-store';
import { contentToken, type SyncChoice, mergeDecision, readCloud, writeCloud, type CloudRecord } from '../../../../src/shared/cloud';
import { syncKey } from '../../../../src/shared/sync';
import { acceptRemote, acknowledge, deviceId, listBases, listRecords, preference, saveConflict, setPreference } from './store';
export interface FirebaseConfig {apiKey:string;projectId:string;webClientId?:string;}
export interface FirebaseSession {uid:string;idToken:string;refreshToken:string;projectId:string;}
const SESSION_KEY='body-os-firebase-session';
export async function signIn(config:FirebaseConfig,email:string,password:string):Promise<FirebaseSession> {
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error('Unable to sign in. Check the project, email and password.');
  const value=await response.json() as {localId:string;idToken:string;refreshToken:string};
  return storeSession(config,value);
}
async function storeSession(config:FirebaseConfig,value:{localId:string;idToken:string;refreshToken:string}) {
  if(!value.localId||!value.idToken||!value.refreshToken)throw new Error('Firebase did not return a complete session.');
  const account=`${config.projectId}/${value.localId}`;
  const bound=await preference('syncAccount','');
  if(bound && bound!==account) throw new Error('This local database belongs to another account. Sign in with the original account to avoid mixing records.');
  await setPreference('syncAccount',account);
  const session={uid:value.localId,idToken:value.idToken,refreshToken:value.refreshToken,projectId:config.projectId};
  await SecureStore.setItemAsync(SESSION_KEY,JSON.stringify(session));
  await setPreference('firebaseConfig',config);
  return session;
}
export async function signInWithGoogle(config:FirebaseConfig):Promise<FirebaseSession|null> {
  if(!config.webClientId||!config.apiKey||!config.projectId)throw new Error('Google sign-in needs the Firebase API key and Google Web client ID in cloud settings.');
  const {GoogleSignin,isSuccessResponse}=await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({webClientId:config.webClientId});
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog:true});
  const result=await GoogleSignin.signIn();
  if(!isSuccessResponse(result))return null;
  if(!result.data.idToken)throw new Error('Google did not return an ID token. Check the Web client ID and Android signing certificate configuration.');
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(config.apiKey)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
    body:JSON.stringify({postBody:`id_token=${encodeURIComponent(result.data.idToken)}&providerId=google.com`,requestUri:`https://${config.projectId}.firebaseapp.com`,returnSecureToken:true}),
  });
  if(!response.ok)throw new Error('Google account could not connect to Firebase. Check that Google sign-in is enabled; an existing account may need linking.');
  return storeSession(config,await response.json());
}
export async function signOut() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  // Keep the account binding and local records: signing out must not allow accidental account mixing.
}
export async function savedSession():Promise<FirebaseSession|null> {const raw=await SecureStore.getItemAsync(SESSION_KEY);return raw?JSON.parse(raw):null;}
async function renew(config:FirebaseConfig,session:FirebaseSession):Promise<FirebaseSession> {
  if(session.projectId!==config.projectId) throw new Error('Sign in to this Firebase project first.');
  const response=await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error('Sign in again to resume cloud sync.');
  const data=await response.json() as {id_token:string;refresh_token:string};
  const next={...session,idToken:data.id_token,refreshToken:data.refresh_token};
  await SecureStore.setItemAsync(SESSION_KEY,JSON.stringify(next));return next;
}
let busy=false;
export async function previewSync(config:FirebaseConfig,input:FirebaseSession){
  if(busy)throw new Error('Sync is already running.');busy=true;
  try{
    const session=await renew(config,input);
    const remote=new Map((await readCloud(config,session)).map(r=>[syncKey(r),r]));
    const [rows,bases]=await Promise.all([listRecords(),listBases()]);
    const local=new Map(rows.map(r=>[syncKey(r),r]));
    const counts={local:rows.filter(r=>!r.deletedAt).length,cloud:[...remote.values()].filter(r=>!r.deletedAt).length,upload:0,download:0,conflict:0,same:0};
    for(const key of new Set([...local.keys(),...remote.keys()]))counts[mergeDecision(local.get(key),remote.get(key),bases.get(key))]++;
    return counts;
  }finally{busy=false;}
}
export async function syncNow(config:FirebaseConfig,input:FirebaseSession,choices:Record<string,SyncChoice>={},onProgress?:(message:string)=>void) {
  if(busy) throw new Error('Sync is already running.');busy=true;
  try {
    onProgress?.('Connecting to your account…');
    const session=await renew(config,input);
    onProgress?.('Reading cloud records…');
    const remote=new Map((await readCloud(config,session)).map(r=>[syncKey(r),r]));
    const [localRows,base,device]=await Promise.all([listRecords(),listBases(),deviceId()]);
    const local=new Map(localRows.map(r=>[syncKey(r),r]));
    let uploaded=0,downloaded=0;const conflicts:string[]=[];
    const keys=[...new Set([...local.keys(),...remote.keys()])];let processed=0;
    for(const key of keys) {
      onProgress?.(`Checking record ${++processed} of ${keys.length} · ${uploaded} uploaded · ${downloaded} downloaded`);
      const l=local.get(key),r=remote.get(key);let decision=mergeDecision(l,r,base.get(key));
      if(decision==='conflict' && (choices[key]?.side==='local'||choices[key]?.side==='remote') && choices[key]?.cloudVersion===r?.cloudVersion && choices[key]?.localToken===contentToken(l)) decision=choices[key].side==='local'?'upload':'download';
      if(decision==='conflict') {await saveConflict(l!,r!);conflicts.push(key);continue;}
      if(decision==='same' && l && r) await acknowledge(r,l);
      if(decision==='download' && r) {await acceptRemote(r,l);downloaded++;}
      if(decision==='upload' && l) {
        const saved=await writeCloud(config,session,{...l,deviceId:device,updatedAt:new Date().toISOString(),revision:Math.max(l.revision,r?.revision || 0)+1},r);
        await acknowledge(saved,l);uploaded++;
      }
    }
    await setPreference('lastSync',new Date().toISOString());
    return {uploaded,downloaded,conflicts};
  } finally {busy=false;}
}
