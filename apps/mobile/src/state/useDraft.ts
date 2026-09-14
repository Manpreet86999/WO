import {useEffect,useRef,useState} from 'react';
import {clearDraft,readDraft,writeDraft} from '../lib/drafts';
export function useDraft<T>(key:string,initial:T){const [value,setValue]=useState(initial),[loaded,setLoaded]=useState(false),[error,setError]=useState('');const last=useRef(initial);
useEffect(()=>{let cancelled=false;setLoaded(false);setError('');void readDraft(key,initial).then(v=>{if(!cancelled){last.current=v;setValue(v);setLoaded(true);}}).catch(e=>{if(!cancelled)setError((e as Error).message);});return()=>{cancelled=true;};},[key]);
function update(next:T){last.current=next;setValue(next);if(loaded)void writeDraft(key,next).catch(e=>setError((e as Error).message));}
async function clear(){await clearDraft(key);}
return {value,set:update,loaded,error,clear};}
