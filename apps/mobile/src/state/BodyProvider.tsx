import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import {listRecords,preference,setPreference,subscribeLocalChanges} from '../lib/store';
import type {SyncRecord,SyncEntityType} from '../../../../src/shared/sync';
import {ThemeProvider} from '../ui/theme';
type Mode='dark'|'light'|'system';
type State={records:SyncRecord[];loading:boolean;error:string;refresh:()=>Promise<void>;rows:<T>(type:SyncEntityType)=>Array<SyncRecord<T>>;theme:Mode;setTheme:(m:Mode)=>Promise<void>;units:string;};
const Context=createContext<State|null>(null);
export function BodyProvider({children}:{children:ReactNode}){const [records,setRecords]=useState<SyncRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[theme,setMode]=useState<Mode>('dark');
const refresh=useCallback(async()=>{try{setRecords(await listRecords());setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
useEffect(()=>{void refresh();void preference<Mode>('appearance','dark').then(setMode);return subscribeLocalChanges(()=>void refresh());},[refresh]);
const setTheme=async(m:Mode)=>{await setPreference('appearance',m);setMode(m);};
const rows=<T,>(type:SyncEntityType)=>records.filter(r=>r.entityType===type&&!r.deletedAt) as SyncRecord<T>[];
const units=(rows<{units?:string}>('profile')[0]?.payload.units)||'kg';
return <Context.Provider value={{records,loading,error,refresh,rows,theme,setTheme,units}}><ThemeProvider mode={theme}>{children}</ThemeProvider></Context.Provider>;}
export function useBody(){const value=useContext(Context);if(!value)throw new Error('BodyProvider missing');return value;}
