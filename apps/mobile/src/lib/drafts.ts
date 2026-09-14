import {preference,setPreference} from './store';
export interface DraftRecord<T>{version:1;key:string;updatedAt:string;value:T;}
const queues=new Map<string,Promise<void>>();
const listeners=new Map<string,Set<()=>void>>();
export function subscribeDraft(key:string,fn:()=>void){const set=listeners.get(key)||new Set();set.add(fn);listeners.set(key,set);return()=>{set.delete(fn);};}
export async function flushDraft(key:string){await queues.get(key);}
export async function readDraft<T>(key:string,fallback:T):Promise<T>{const draft=await preference<DraftRecord<T>|null>(`draft:v1:${key}`,null);return draft?.version===1?draft.value:fallback;}
export function writeDraft<T>(key:string,value:T){const next=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(()=>setPreference(`draft:v1:${key}`,{version:1,key,updatedAt:new Date().toISOString(),value} satisfies DraftRecord<T>));queues.set(key,next);return next;}
export function clearDraft(key:string){const next=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(()=>setPreference(`draft:v1:${key}`,null));queues.set(key,next);return next;}
export type ScreenState='loading'|'empty'|'ready'|'saving'|'error';
