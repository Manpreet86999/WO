import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
const KEY='body-os-app-lock-v1';
type Lock={version:1;salt:string;pinHash:string;recoveryHash:string;failures:number;blockedUntil:number;};
const hash=(text:string)=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,text);
const random=()=>Array.from(Crypto.getRandomBytes(24)).map(n=>n.toString(16).padStart(2,'0')).join('');
const read=async()=>{const raw=await SecureStore.getItemAsync(KEY);return raw?JSON.parse(raw) as Lock:null;};
const write=(lock:Lock)=>SecureStore.setItemAsync(KEY,JSON.stringify(lock));
export const hasAppLock=async()=>Boolean(await read());
export async function enableAppLock(pin:string){if(await read())throw new Error('Disable your current PIN before setting a new one.');if(!/^\d{6}$/.test(pin))throw new Error('Choose a six-digit PIN.');const salt=random(),recovery=random();await write({version:1,salt,pinHash:await hash(`${salt}:pin:${pin}`),recoveryHash:await hash(`${salt}:recovery:${recovery}`),failures:0,blockedUntil:0});return recovery;}
export async function verifyAppLock(value:string,recovery=false){const lock=await read();if(!lock)return true;if(Date.now()<lock.blockedUntil)throw new Error(`Try again in ${Math.ceil((lock.blockedUntil-Date.now())/1000)} seconds.`);const actual=await hash(`${lock.salt}:${recovery?'recovery':'pin'}:${value.trim()}`);const expected=recovery?lock.recoveryHash:lock.pinHash;if(actual!==expected){const failures=lock.failures+1;await write({...lock,failures,blockedUntil:failures>=5?Date.now()+Math.min(300000,30000*2**Math.min(4,failures-5)):0});throw new Error(recovery?'Recovery code does not match.':'PIN does not match.');}await write({...lock,failures:0,blockedUntil:0});return true;}
export async function disableAppLock(value:string,recovery=false){await verifyAppLock(value,recovery);await SecureStore.deleteItemAsync(KEY);}
