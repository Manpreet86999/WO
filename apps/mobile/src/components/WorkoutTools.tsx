import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { generateWarmupSets, plateCalculator } from '../../../../src/shared/training';
import { formatWorkoutSet } from '../../../../src/shared/workout-entry';
import type { Session } from '../../../../src/shared/types';
import type { SyncRecord } from '../../../../src/shared/sync';
export function WorkoutTools({records,exercise,units,onWarmup}:{records:SyncRecord[];exercise:string;units:'kg'|'lb';onWarmup:(weight:string,reps:string)=>void}) {
  const [target,setTarget]=useState(''),[bar,setBar]=useState(''),[open,setOpen]=useState(false);
  const barWeight=bar===''?(units==='kg'?20:45):Number(bar);
  const valid=target.trim()!==''&&Number.isFinite(Number(target))&&Number(target)>0&&Number(target)<=5000&&Number.isFinite(barWeight)&&barWeight>0&&barWeight<=500;
  const plates=valid?plateCalculator(Number(target),units,barWeight):null;
  const history=records.filter(r=>r.entityType==='session'&&!r.deletedAt&&(r.payload as Session).status==='finished').map(r=>r.payload as Session).sort((a,b)=>b.date.localeCompare(a.date)).find(s=>s.logs.some(l=>l.name===exercise));
  const last=history?.logs.find(l=>l.name===exercise);
  return <View style={{padding:16,gap:10,backgroundColor:'#17191F',borderRadius:18}}><Pressable accessibilityRole="button" style={{padding:12}} onPress={()=>setOpen(!open)}><Text style={{color:'#9EEA22'}}>Previous sets, warm-up and plates {open?'−':'+'}</Text></Pressable>{open&&<>
    <Text style={{color:'#F6F7F8'}}>{last?`Last recorded ${history!.date}: ${last.sets.map(s=>formatWorkoutSet(s,units)).join(' · ')}`:'No previous sets for this exercise.'}</Text>
    <Text style={{color:'#A7ADB7'}}>Target load ({units})</Text><TextInput accessibilityLabel="Target load for plates and warm-up" keyboardType="decimal-pad" value={target} onChangeText={setTarget} style={{color:'#F6F7F8',padding:12,borderWidth:1,borderColor:'#53645a'}}/>
    <Text style={{color:'#A7ADB7'}}>Bar weight ({units}); default {units==='kg'?20:45}</Text><TextInput accessibilityLabel="Bar weight" keyboardType="decimal-pad" value={bar} onChangeText={setBar} style={{color:'#F6F7F8',padding:12,borderWidth:1,borderColor:'#53645a'}}/>
    {plates&&<><Text style={{color:'#F6F7F8'}}>Per side: {plates.perSide.join(' + ')||'No plates'} {units}. Loaded: {plates.total} {units}. Difference from target: {plates.remainder} {units}.</Text>{Number(target)>=barWeight&&generateWarmupSets(Number(target),5,barWeight).map((set,index)=><Pressable accessibilityRole="button" key={index} style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={()=>onWarmup(String(set.w),String(set.r))}><Text style={{color:'#F6F7F8'}}>Prepare warm-up: {set.w} {units} × {set.r}</Text></Pressable>)}<Text style={{color:'#A7ADB7'}}>Selecting a warm-up fills the entry. Save the set only after performing it.</Text></>}
  </>}</View>;
}
