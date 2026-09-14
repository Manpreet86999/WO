import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import type { Session, SetLog } from '../../../../src/shared/types';
import type { SyncRecord } from '../../../../src/shared/sync';
import { formatWorkoutSet, parseWorkoutSet } from '../../../../src/shared/workout-entry';
import { dateKeySchema } from '../../../../src/shared/schemas';
import { logTonnage } from '../../../../src/shared/training';
import { deviceId, saveRecord } from '../lib/store';
function Button({label,action,disabled=false}:{label:string;action:()=>void;disabled?:boolean}) {return <Pressable accessibilityRole="button" disabled={disabled} style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={action}><Text style={{color:'#F6F7F8'}}>{label}</Text></Pressable>;}
function Field({label,value,change}:{label:string;value:unknown;change:(v:string)=>void}) {return <View><Text style={{color:'#A7ADB7'}}>{label}</Text><TextInput accessibilityLabel={label} value={String(value??'')} onChangeText={change} style={{padding:12,color:'#F6F7F8',borderWidth:1,borderColor:'#53645a',borderRadius:8}}/></View>;}
export function WorkoutHistory({records,units,onSaved}:{records:SyncRecord[];units:string;onSaved:()=>Promise<void>}) {
  const [draft,setDraft]=useState<Session|null>(null),[query,setQuery]=useState(''),[limit,setLimit]=useState(20),[busy,setBusy]=useState(false);
  const sessions=records.filter(r=>r.entityType==='session'&&!r.deletedAt&&(r.payload as Session).status==='finished').map(r=>r.payload as Session).sort((a,b)=>b.date.localeCompare(a.date)).filter(s=>`${s.date} ${s.dayTitle} ${s.logs.map(l=>l.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  function changeSet(li:number,si:number,patch:Partial<SetLog>) {if(draft)setDraft({...draft,logs:draft.logs.map((l,i)=>i===li?{...l,sets:l.sets.map((s,j)=>j===si?{...s,...patch}:s)}:l)});}
  async function save(deleting=false){if(!draft||busy)return;setBusy(true);try{
    if(!deleting){if(!dateKeySchema.safeParse(draft.date).success)throw new Error('Use a real date in YYYY-MM-DD format.');for(const log of draft.logs){if(!log.name.trim())throw new Error('Exercise names cannot be empty.');log.sets=log.sets.map((set,i)=>parseWorkoutSet({...set,s:i+1},set.trackingMode||log.trackingMode||'weight_reps'));}}
    const now=new Date().toISOString();await saveRecord({id:draft.id,entityType:'session',payload:{...draft,updatedAt:now},updatedAt:now,revision:1,deviceId:await deviceId(),...(deleting?{deletedAt:now}:{})});await onSaved();setDraft(null);
  }catch(error){Alert.alert('Workout not saved',(error as Error).message);}finally{setBusy(false);}}
  return <View style={{padding:16,gap:12,backgroundColor:'#17191F',borderRadius:18}}><Text style={{color:'#9EEA22',fontSize:20}}>Workout history</Text>{draft?<>
    <Field label="Workout date" value={draft.date} change={date=>setDraft({...draft,date})}/><Field label="Workout title" value={draft.dayTitle} change={dayTitle=>setDraft({...draft,dayTitle})}/><Field label="Session notes" value={draft.notes} change={notes=>setDraft({...draft,notes})}/>
    {draft.logs.map((log,li)=><View key={li} style={{gap:10,paddingVertical:12,borderTopWidth:1,borderColor:'#53645a'}}><Text style={{color:'#F6F7F8',fontSize:19}}>{log.name}</Text><Field label="Exercise notes" value={log.journal} change={journal=>setDraft({...draft,logs:draft.logs.map((l,i)=>i===li?{...l,journal}:l)})}/>
      {log.sets.map((set,si)=><View key={si} style={{gap:8,padding:8}}><Text style={{color:'#9EEA22'}}>Set {si+1}: {formatWorkoutSet(set,units)}</Text>{(set.trackingMode||log.trackingMode)==='time'?<Field label="Duration (seconds)" value={set.durationSec} change={durationSec=>changeSet(li,si,{durationSec})}/>:<>{(set.trackingMode||log.trackingMode)!=='reps'&&<Field label={`Load (${units})`} value={set.w} change={w=>changeSet(li,si,{w})}/>}<Field label="Repetitions" value={set.r} change={r=>changeSet(li,si,{r})}/></>}
        <Field label="RIR" value={set.rir} change={rir=>changeSet(li,si,{rir})}/><Field label="RPE" value={set.rpe} change={rpe=>changeSet(li,si,{rpe})}/>
        {['warmup','work','amrap','drop','failure','backoff'].map(type=><Button key={type} label={`${set.type===type?'✓ ':''}${type}`} action={()=>changeSet(li,si,{type})}/>)}
        <Button label="Remove set" action={()=>Alert.alert('Remove set?','Save the workout to apply the change.',[{text:'Cancel',style:'cancel'},{text:'Remove',onPress:()=>setDraft({...draft,logs:draft.logs.map((l,i)=>i===li?{...l,sets:l.sets.filter((_,j)=>j!==si)}:l)})}])}/>
      </View>)}
    </View>)}<Button label={busy?'Saving…':'Save changes'} disabled={busy} action={()=>void save()}/><Button label="Cancel" disabled={busy} action={()=>Alert.alert('Discard edits?','The saved workout will remain unchanged.',[{text:'Keep editing',style:'cancel'},{text:'Discard',onPress:()=>setDraft(null)}])}/><Button label="Delete workout" disabled={busy} action={()=>Alert.alert('Delete workout?','This deletion will sync to your other devices.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void save(true)}])}/>
  </>:<><Field label="Search date, workout or exercise" value={query} change={v=>{setQuery(v);setLimit(20);}}/><Text style={{color:'#A7ADB7'}}>{sessions.length} matching workouts</Text>{sessions.slice(0,limit).map(session=><View key={session.id} style={{gap:8}}><Text style={{color:'#A7ADB7'}}>{session.logs.reduce((n,l)=>n+logTonnage(l),0).toFixed(0)} {units} working-set volume</Text><Button label={`${session.date} · ${session.dayTitle} · ${session.logs.length} exercises`} action={()=>setDraft(JSON.parse(JSON.stringify(session)))}/></View>)}{sessions.length>limit&&<Button label="Show more" action={()=>setLimit(limit+20)}/>}</>}</View>;
}
