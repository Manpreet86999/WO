import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import type { Exercise, PlannedExercise, Week, WeekDay } from '../../../../src/shared/types';
import type { SyncRecord } from '../../../../src/shared/sync';
import { defaultExerciseCatalog } from '../../../../src/shared/exercise-catalog';
import { dateKeySchema } from '../../../../src/shared/schemas';
import { localDateKey } from '../../../../src/shared/evidence';
import { deviceId, saveRecord, saveRecordsAtomically } from '../lib/store';

function Action({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}) {return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{padding:14,minHeight:48,backgroundColor:'#232A35',borderRadius:10,opacity:disabled?.5:1}}><Text style={{color:'#F6F7F8'}}>{title}</Text></Pressable>;}
function Input({label,value,onChange}:{label:string;value:unknown;onChange:(v:string)=>void}) {return <View style={{gap:5}}><Text style={{color:'#A7ADB7'}}>{label}</Text><TextInput accessibilityLabel={label} value={String(value??'')} onChangeText={onChange} style={{color:'#F6F7F8',padding:12,borderWidth:1,borderColor:'#53645a',borderRadius:10}}/></View>;}
const id=()=>`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
export function PlanEditor({records,onSaved,entityType='week'}:{records:SyncRecord[];onSaved:()=>Promise<void>;entityType?:'week'|'librarySplit'}) {
  const [plan,setPlan]=useState<Week|null>(null),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[pickDay,setPickDay]=useState<number|null>(null);
  const catalog=useMemo(()=>{const map=new Map(defaultExerciseCatalog().map(e=>[e.id,e]));for(const row of records.filter(r=>r.entityType==='exercise')){if(row.deletedAt)map.delete(row.id);else map.set(row.id,row.payload as Exercise);}return [...map.values()].filter(e=>!e.meta?.archived);},[records]);
  function dayChange(index:number,patch:Partial<WeekDay>) {if(plan)setPlan({...plan,days:plan.days.map((d,i)=>i===index?{...d,...patch}:d)});}
  function exerciseChange(di:number,ei:number,patch:Partial<PlannedExercise>) {if(plan)dayChange(di,{exercises:plan.days[di].exercises.map((e,i)=>i===ei?{...e,...patch}:e)});}
  async function save(deleted=false) {
    if(!plan||busy)return;setBusy(true);
    try {
      if(!deleted){
        if(!plan.name.trim()||!dateKeySchema.safeParse(plan.startDate).success)throw new Error('Enter a plan name and a real start date (YYYY-MM-DD).');
        if(!plan.days.length)throw new Error('Add at least one day.');
        for(const day of plan.days){
          if(!day.title.trim())throw new Error('Each day needs a title.');
          if(day.scheduledDate&&!dateKeySchema.safeParse(day.scheduledDate).success)throw new Error('Check the scheduled date.');
          for(const e of day.exercises){
            if(!e.name.trim()||!e.vol.trim())throw new Error('Each exercise needs a name and prescription.');
            for(const [key,max] of [['restSec',86400],['rirTarget',10],['rpeTarget',10],['percent1rm',200]] as const){const value=e[key];if(value!==''&&value!=null&&(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>max))throw new Error(`Check ${e.name}: ${key}.`);}
          }
        }
      }
      const now=new Date().toISOString(),device=await deviceId();const changes:SyncRecord[]=[{id:plan.id,entityType,payload:entityType==='librarySplit'?{...plan,active:false,status:'library'}:plan,updatedAt:now,revision:1,deviceId:device,...(deleted?{deletedAt:now}:{})}];if(entityType==='week'&&plan.active&&!deleted)changes.push({id:'workspace-state',entityType:'workspaceState',payload:{activeWeekId:plan.id},updatedAt:now,revision:1,deviceId:device});await saveRecordsAtomically(changes);await onSaved();setPlan(null);setPickDay(null);
    }catch(error){Alert.alert('Plan not saved',(error as Error).message);}finally{setBusy(false);}
  }
  return <View style={{padding:16,gap:12,backgroundColor:'#17191F',borderRadius:18}}><Text style={{color:'#9EEA22',fontSize:20,fontWeight:'700'}}>{entityType==='librarySplit'?'Saved library splits':'Full plan editor'}</Text>{!plan?<>
    <Action title="Create week" onPress={()=>setPlan({id:`week-${id()}`,name:'',weekNumber:1,startDate:localDateKey(),notes:'',active:true,days:[]})}/>
    {records.filter(r=>r.entityType===entityType&&!r.deletedAt).map(row=><View key={row.id} style={{gap:8}}><Action title={`Edit ${(row.payload as Week).name}`} onPress={()=>setPlan(JSON.parse(JSON.stringify(row.payload)))}/><Action title="Duplicate week" onPress={()=>{const copy=JSON.parse(JSON.stringify(row.payload)) as Week;setPlan({...copy,id:`week-${id()}`,name:`${copy.name} (copy)`,active:false});}}/></View>)}
  </>:<>
    <Input label="Plan name" value={plan.name} onChange={name=>setPlan({...plan,name})}/><Input label="Week number" value={plan.weekNumber} onChange={weekNumber=>setPlan({...plan,weekNumber})}/><Input label="Start date (YYYY-MM-DD)" value={plan.startDate} onChange={startDate=>setPlan({...plan,startDate})}/><Input label="Notes" value={plan.notes} onChange={notes=>setPlan({...plan,notes})}/><Text style={{color:'#A7ADB7'}}>Active plan</Text><Switch accessibilityLabel="Active plan" value={plan.active} onValueChange={active=>setPlan({...plan,active})}/>
    {plan.days.map((day,di)=><View key={day.key} style={{gap:12,paddingVertical:12,borderTopWidth:1,borderColor:'#53645a'}}>
      <Input label={`Day ${di+1} title`} value={day.title} onChange={title=>dayChange(di,{title})}/><Input label="Day type (workout/rest)" value={day.type} onChange={type=>dayChange(di,{type})}/><Input label="Subtitle" value={day.subtitle} onChange={subtitle=>dayChange(di,{subtitle})}/><Input label="Scheduled date (optional)" value={day.scheduledDate} onChange={scheduledDate=>dayChange(di,{scheduledDate})}/>
      {day.exercises.map((e,ei)=><View key={`${day.key}-${ei}`} style={{gap:8,padding:10,backgroundColor:'#11141A',borderRadius:10}}>
        {(['name','target','vol','cue','supersetGroup','restSec','tempo','rirTarget','rpeTarget','percent1rm','notes'] as const).map(key=><Input key={key} label={({name:'Exercise',target:'Muscle target',vol:'Prescription (for example 3 x 8 or 3 x 30 sec)',cue:'Cue',supersetGroup:'Superset group',restSec:'Rest seconds',tempo:'Tempo',rirTarget:'Target RIR',rpeTarget:'Target RPE',percent1rm:'% of estimated 1RM',notes:'Notes'})[key]} value={e[key]} onChange={v=>exerciseChange(di,ei,{[key]:v})}/>)}
        {(['weight_reps','reps','time'] as const).map(mode=><Action key={mode} title={`${e.trackingMode===mode?'✓ ':''}${mode}`} onPress={()=>exerciseChange(di,ei,{trackingMode:mode})}/>)}
        <Action title="Move exercise up" disabled={ei===0} onPress={()=>{const exercises=[...day.exercises];[exercises[ei-1],exercises[ei]]=[exercises[ei],exercises[ei-1]];dayChange(di,{exercises});}}/>
        <Action title="Remove exercise" onPress={()=>Alert.alert('Remove exercise?','This changes the plan when you save it.',[{text:'Cancel',style:'cancel'},{text:'Remove',onPress:()=>dayChange(di,{exercises:day.exercises.filter((_,i)=>i!==ei)})}])}/>
      </View>)}
      <Action title="Add from exercise library" onPress={()=>{setPickDay(di);setQuery('');}}/><Action title="Add custom exercise" onPress={()=>dayChange(di,{exercises:[...day.exercises,{name:'',target:'',vol:'',cue:'',trackingMode:'weight_reps'}]})}/>
      {pickDay===di&&<><Input label="Search library (name, muscle, equipment)" value={query} onChange={setQuery}/>{catalog.filter(e=>`${e.name} ${e.muscles.join(' ')} ${e.equipment}`.toLowerCase().includes(query.toLowerCase())).slice(0,20).map(e=><Action key={e.id} title={`${e.name} · ${e.equipment}`} onPress={()=>{dayChange(di,{exercises:[...day.exercises,{name:e.name,target:e.muscles.join(', '),vol:'',cue:e.defaultCue||'',exerciseId:e.id,familyId:e.familyId,trackingMode:e.trackingMode,restSec:e.defaultRestSec,tempo:e.defaultTempo}]});setPickDay(null);}}/>) }<Text style={{color:'#A7ADB7'}}>Showing up to 20 matches. Refine your search. Enter the prescription after adding.</Text></>}
      <Action title="Move day up" disabled={di===0} onPress={()=>{const days=[...plan.days];[days[di-1],days[di]]=[days[di],days[di-1]];setPlan({...plan,days});setPickDay(null);}}/><Action title="Remove day" onPress={()=>Alert.alert('Remove day?','Its planned exercises will be removed when you save.',[{text:'Cancel',style:'cancel'},{text:'Remove',onPress:()=>{setPlan({...plan,days:plan.days.filter((_,i)=>i!==di)});setPickDay(null);}}])}/>
    </View>)}
    <Action title="Add day" onPress={()=>setPlan({...plan,days:[...plan.days,{key:`day-${id()}`,type:'workout',title:'',subtitle:'',muscles:[],exercises:[]}]})}/><Action title={busy?'Saving…':'Save plan'} disabled={busy} onPress={()=>void save()}/><Action title="Cancel editing" disabled={busy} onPress={()=>Alert.alert('Discard edits?','Saved plans will remain unchanged.',[{text:'Keep editing',style:'cancel'},{text:'Discard',onPress:()=>{setPlan(null);setPickDay(null);}}])}/>
    {records.some(r=>r.entityType===entityType&&r.id===plan.id&&!r.deletedAt)&&<Action title="Delete plan" disabled={busy} onPress={()=>Alert.alert('Delete plan?','Completed workout history will remain. The deletion will sync to other devices.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void save(true)}])}/>}
  </>}</View>;
}
