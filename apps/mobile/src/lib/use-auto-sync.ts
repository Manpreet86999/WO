import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { subscribeLocalChanges, subscribePreferences } from './store';

/** Coalesce writes and foreground resumes; do not poll idle cloud collections. */
export function useAutoSync(enabled:boolean,perform:()=>Promise<void>,onError:(message:string)=>void) {
  const action=useRef(perform),error=useRef(onError);
  action.current=perform;error.current=onError;
  useEffect(()=>{
    if(!enabled)return;
    let timer:ReturnType<typeof setTimeout>|undefined,stopped=false,running=false,pending=false,last=0,failures=0;
    const schedule=()=>{
      pending=true;if(stopped||running||timer||AppState.currentState!=='active')return;
      timer=setTimeout(()=>{timer=undefined;void execute();},Math.max(1500,60000-(Date.now()-last)));
    };
    const execute=async()=>{
      if(stopped||AppState.currentState!=='active')return;
      pending=false;running=true;last=Date.now();
      try{await action.current();failures=0;}
      catch(e){failures++;error.current(`Sync paused: ${(e as Error).message} Local records are safe.`);if(failures<3)pending=true;}
      finally{running=false;if(pending&&!stopped)schedule();}
    };
    const unsubscribe=subscribeLocalChanges(schedule);
    const unsubscribePreferences=subscribePreferences(key=>{if(key==='autoSync'||key==='firebaseConfig')schedule();});
    const appState=AppState.addEventListener('change',state=>{if(state==='active'){failures=0;schedule();}});
    schedule();
    return()=>{stopped=true;unsubscribe();unsubscribePreferences();appState.remove();if(timer)clearTimeout(timer);};
  },[enabled]);
}
