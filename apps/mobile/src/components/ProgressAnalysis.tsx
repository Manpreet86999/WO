import { TrendChart } from './TrendChart';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { computeMetrics } from '../../../../src/shared/metrics';
import { snapshotFromRecords } from '../../../../src/shared/record-snapshot';
import type { SyncRecord } from '../../../../src/shared/sync';
export function ProgressAnalysis({records,units}:{records:SyncRecord[];units:string}) {
  const metrics=useMemo(()=>computeMetrics(snapshotFromRecords(records)),[records]);
  const [section,setSection]=useState('Overview'),[query,setQuery]=useState('');
  const line=(label:string,value:unknown)=><Text key={label} style={{color:'#F6F7F8',lineHeight:24}}>{label}: {String(value)}</Text>;
  return <View style={{padding:16,gap:10,backgroundColor:'#17191F',borderRadius:18}}><Text style={{color:'#9EEA22',fontSize:20}}>Training analysis</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{['Overview','Strength','Weekly volume','Muscles','Readiness','Goals','Body','Progression'].map(name=><Pressable accessibilityRole="button" key={name} style={{padding:12,backgroundColor:section===name?'#2C3038':'#232A35',borderRadius:8}} onPress={()=>setSection(name)}><Text style={{color:'#F6F7F8'}}>{name}</Text></Pressable>)}</View>
    {section==='Overview'&&<>{line('Completed workouts',metrics.totals.sessions)}{line(`Working volume (${units})`,metrics.totals.tonnage.toFixed(0))}{line('Average session minutes',metrics.totals.avgSessionMinutes||0)}{metrics.weekCompare&&<>{line('This week sessions',metrics.weekCompare.current.sessions)}{line('Last week sessions',metrics.weekCompare.previous.sessions)}{line('This week sets',metrics.weekCompare.current.sets)}{line('Last week sets',metrics.weekCompare.previous.sets)}</>}{metrics.deload&&line('Recovery guidance',metrics.deload.reason)}</>}
    {section==='Strength'&&<><TextInput accessibilityLabel="Find lift" placeholder="Find lift" placeholderTextColor="#A7ADB7" value={query} onChangeText={setQuery} style={{padding:12,color:'#F6F7F8',borderWidth:1,borderColor:'#53645a'}}/>{metrics.personalRecords.filter(p=>p.exercise.toLowerCase().includes(query.toLowerCase())).map(p=><View key={p.exercise} style={{gap:5,paddingVertical:8}}>{line(p.exercise,`${p.bestWeight} ${units} × ${p.bestReps}; estimated 1RM ${p.bestE1rm} ${units}`)}<TrendChart title="Estimated strength trend" points={(metrics.e1rmSeries[p.exercise]||[]).map(point=>({date:point.date,value:point.e1rm}))} unit={units}/>{(metrics.e1rmSeries[p.exercise]||[]).map((point,i)=>line(`${point.date} (${i+1})`,`${point.weight} × ${point.reps}; estimated 1RM ${point.e1rm.toFixed(1)}`))}</View>)}<Text style={{color:'#A7ADB7'}}>Estimated strength uses the same calculation as web. These are estimates, not tested maximums.</Text></>}
    {section==='Weekly volume'&&<><TrendChart title="Weekly training volume" points={metrics.weeklyVolume.map(v=>({date:v.weekStart,value:v.tonnage}))} unit={units}/>{metrics.weeklyVolume.map(v=>line(v.weekStart,`${v.sessions} sessions · ${v.sets} sets · ${v.tonnage.toFixed(0)} ${units}`))}</>}
    {section==='Muscles'&&<>{metrics.volumeLandmarks.map(v=>line(v.muscle,`${v.weeklySets} sets · ${v.status}`))}{metrics.imbalanceFlags?.map(v=>line(v.exercise,v.note))}</>}
    {section==='Readiness'&&<><TrendChart title="Readiness history" points={metrics.readiness.map(r=>({date:r.date,value:r.score}))} unit="/100"/>{metrics.readiness.map((r,i)=>line(`${r.date} (${i+1})`,`${r.score}/100 · ${r.band}`))}</>}
    {section==='Body'&&(['weight','waist','bodyFat','muscleMass','waterPercentage'] as const).map(key=><TrendChart key={key} title={key} points={metrics.measurementTrend.filter(m=>m[key]!==''&&m[key]!=null).map(m=>({date:m.date,value:Number(m[key])}))} unit={key==='weight'||key==='muscleMass'?units:key==='waist'?(units==='kg'?'cm':'in'):'%'}/>)}
    {section==='Goals'&&metrics.goalProgress.map(g=>line(g.name,`${g.current} / ${g.target} ${g.unit} · ${g.percent}% · ${g.status}`))}
    {section==='Progression'&&<>{metrics.progressionRules?.map(p=>line(p.exercise,p.reason))}{metrics.plateaus.map(p=>line(`${p.exercise} plateau`,p.note))}</>}
    {!metrics.totals.sessions&&<Text style={{color:'#A7ADB7'}}>Log a workout to populate training analysis.</Text>}
  </View>;
}
