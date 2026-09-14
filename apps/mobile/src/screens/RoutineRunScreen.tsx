import {useEffect,useRef,useState} from 'react';
import {Alert,AppState} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Action,Card,Heading,Kicker,Label,Loading,Page,Row} from '../ui/kit';
import {useBody} from '../state/BodyProvider';
import {useNav,type RootRoutes} from '../navigation/routes';
import {deviceId,saveRecord} from '../lib/store';
import {localDateKey} from '../../../../src/shared/evidence';
import {defaultSkinRoutines,type SkinLog,type SkinRoutine} from '../../../../src/shared/skin';
import {useDraft} from '../state/useDraft';

type RunDraft={step:number;completed:number[];waitEndsAt:number|null};
export function RoutineRunScreen({route}:NativeStackScreenProps<RootRoutes,'RoutineRun'>){
 const {rows,refresh}=useBody(),nav=useNav();
 const routine=rows<SkinRoutine>('skinRoutine').find(row=>row.id===route.params.id)?.payload||defaultSkinRoutines().find(item=>item.id===route.params.id);
 const savedDraft=useDraft<RunDraft>(`routine-run:${route.params.id}:${localDateKey()}`,{step:0,completed:[],waitEndsAt:null});
 const [now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false),lock=useRef(false);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);const subscription=AppState.addEventListener('change',()=>setNow(Date.now()));return()=>{clearInterval(timer);subscription.remove();};},[]);
 if(!savedDraft.loaded||!routine)return <Page><Loading message="Opening routine…"/></Page>;
 const draft=savedDraft.value,visible=routine.steps.filter(step=>!step.paused),step=visible[draft.step];
 if(!step)return <Page><Heading>{routine.name}</Heading><Label muted>Add at least one active step to run this routine.</Label><Action title="Edit routine" onPress={()=>nav.navigate('RoutineEditor',{id:routine.id})}/></Page>;
 const remaining=draft.waitEndsAt===null?0:Math.max(0,Math.ceil((draft.waitEndsAt-now)/1000));
 const completeCurrent=()=>{const completed=[...new Set([...draft.completed,draft.step])];const waitEndsAt=step.waitMin>0?Date.now()+step.waitMin*60_000:null;savedDraft.set({step:Math.min(draft.step+1,visible.length-1),completed,waitEndsAt});};
 async function finish(){if(!routine||lock.current)return;lock.current=true;setBusy(true);try{
   if(draft.completed.length!==visible.length)throw new Error('Complete every active step, or use Back to review the routine.');
   const today=localDateKey(),existing=rows<SkinLog>('skinLog').find(row=>row.payload.date===today);
   const nowIso=new Date().toISOString(),id=existing?.id||`skin-${today}`;
   const payload:SkinLog={id,date:today,barrier:existing?.payload.barrier??null,hydration:existing?.payload.hydration??null,oiliness:existing?.payload.oiliness??null,irritation:existing?.payload.irritation??null,concerns:existing?.payload.concerns||[],notes:existing?.payload.notes||'',routineDone:{am:routine.slot==='am'?true:Boolean(existing?.payload.routineDone.am),pm:routine.slot==='pm'?true:Boolean(existing?.payload.routineDone.pm)},createdAt:existing?.payload.createdAt||nowIso,aiComment:existing?.payload.aiComment,aiAdjustments:existing?.payload.aiAdjustments};
   await saveRecord({id,entityType:'skinLog',payload,updatedAt:nowIso,revision:existing?.revision||1,deviceId:await deviceId()},true,existing?.revision||0);await savedDraft.clear();await refresh();Alert.alert('Routine completed',`${routine.slot.toUpperCase()} routine is recorded. Add observations only if you want to track skin scores.`);nav.goBack();
 }catch(e){Alert.alert('Routine not finished',(e as Error).message);}finally{lock.current=false;setBusy(false);}}
 return <Page><Kicker>{routine.slot==='am'?'Morning ritual':'Evening ritual'}</Kicker><Heading>{routine.name}</Heading><Label muted>Complete each active step. The routine log records completion only; it does not create skin scores.</Label><Card accent><Kicker>Step {draft.step+1} of {visible.length}</Kicker><Heading size={30}>{step.label}</Heading>{step.notes!==''&&<Label>{step.notes}</Label>}<Label muted>{step.productId!==''?'Linked to your product shelf':'No product linked'}</Label></Card>{remaining>0&&<Card><Kicker>Wait timer</Kicker><Heading size={42}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</Heading><Label muted>The countdown continues while the app is in the background.</Label></Card>}<Row><Action secondary title="Back" onPress={()=>savedDraft.set({...draft,step:Math.max(0,draft.step-1),waitEndsAt:null})}/><Action title={draft.completed.includes(draft.step)?'Step completed':'Complete step'} onPress={completeCurrent}/></Row><Card><Kicker>Routine progress</Kicker><Label>{draft.completed.length} of {visible.length} active steps completed</Label></Card>{draft.completed.length===visible.length&&<Action title={busy?'Saving…':'Finish routine'} disabled={busy} onPress={()=>void finish()}/>}</Page>;
}
