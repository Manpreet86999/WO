import { SetEntry } from './src/components/SetEntry';
import { Onboarding } from './src/components/Onboarding';
import { FeatureMenu } from './src/components/FeatureMenu';
import { ReportTools } from './src/components/ReportTools';
import { AiCoach } from './src/components/AiCoach';
import { useAutoSync } from './src/lib/use-auto-sync';
import { WorkoutTools } from './src/components/WorkoutTools';
import { LocalCoach } from './src/components/LocalCoach';
import { BackupTools } from './src/components/BackupTools';
import { ProgramManager } from './src/components/ProgramManager';
import { ExerciseLibrary } from './src/components/ExerciseLibrary';
import { ProgressAnalysis } from './src/components/ProgressAnalysis';
import { bodyOsFirebaseConfig, bodyOsGoogleWebClientId } from '../../src/shared/firebase-config';
import { WorkoutHistory } from './src/components/WorkoutHistory';
import { RoutineEditor } from './src/components/RoutineEditor';
import { PlanEditor } from './src/components/PlanEditor';
import { RestTimer } from './src/components/RestTimer';
import { RecordManager } from './src/components/RecordManager';
import { progressSpecs, careSpecs, profileSpec, scheduleSpec } from './src/components/record-specs';
import { logFromPlan, parseWorkoutSet, formatWorkoutSet } from '../../src/shared/workout-entry';
import {defaultSkinRoutines,type SkinRoutine,type SkinLog} from '../../src/shared/skin';
import { FlashDeck } from './src/components/FlashDeck';
import { contentToken, type SyncChoice } from '../../src/shared/cloud';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { signInWithGoogle, signOut, savedSession, syncNow, type FirebaseConfig, type FirebaseSession } from './src/lib/firebase-sync';
import { deviceId, listConflicts, listRecords, pendingKeys, preference, saveRecord, setPreference } from './src/lib/store';
import { configureReminders, defaultReminders, startRest, type ReminderSettings } from './src/lib/reminders';
import { importHealthReadings } from './src/lib/health-connect';
import { localDateKey } from '../../src/shared/evidence';
import { normalizeReadiness } from '../../src/shared/readiness';
import { summarizeHealth, type HealthReading } from '../../src/shared/health';
import { sessionInputSchema, setSchema } from '../../src/shared/schemas';
import type { SyncRecord } from '../../src/shared/sync';
import type { ExerciseLog, Readiness, Session, Week, PlannedExercise, ExerciseTrackingMode } from '../../src/shared/types';

type Tab='Today'|'Tracker'|'Plan'|'Progress'|'Care'|'More';
const tabs:Tab[]=['Today','Tracker','Progress','Care','More'];
const tabLabels:Record<Tab,string>={Today:'Today',Tracker:'Train',Plan:'Plans',Progress:'Progress',Care:'Care',More:'More'};
type Draft={id:string;date:string;startedAt:string;logs:ExerciseLog[];weekId?:string;weekName?:string;weekNumber?:number|string;setOrder?:string[];planned?:string[];prescriptions?:PlannedExercise[];dayKey?:string;dayTitle?:string};
const readyQuestions=[['sleepHours','How long did you sleep?','Hours last night'],['sleepQuality','How was your sleep?','1 = very poor · 10 = excellent'],['soreness','How sore do you feel?','1 = none · 10 = very sore'],['energy','How is your energy?','1 = drained · 10 = full of energy'],['stress','How much stress today?','1 = calm · 10 = very stressed'],['motivation','Ready to move?','1 = very low · 10 = very motivated'],['mood','How are you feeling?','1 = very low · 10 = great']];
function freshDraft():Draft {return {id:`mobile-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,date:localDateKey(),startedAt:new Date().toISOString(),logs:[]};}
function Section({title,children}:{title:string;children:React.ReactNode}) {return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{children}</View>;}
function Button({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}) {return <Pressable accessibilityRole="button" disabled={disabled} style={[styles.primary,disabled&&{opacity:.5}]} onPress={onPress}><Text style={styles.primaryText}>{title}</Text></Pressable>;}
function Field({label,value,onChange,numeric=false,secret=false}:{label:string;value:string;onChange:(value:string)=>void;numeric?:boolean;secret?:boolean}) {return <View><Text style={styles.muted}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={onChange} keyboardType={numeric?'decimal-pad':'default'} secureTextEntry={secret} autoCapitalize="none" /></View>;}

export default function App() {
  const [autoSync,setAutoSync]=useState(false);
  const [restVersion,setRestVersion]=useState(0);
  const [onboarded,setOnboarded]=useState<boolean|null>(null),[checkingIn,setCheckingIn]=useState(false);
  const [tab,setTab]=useState<Tab>('Today'),[records,setRecords]=useState<SyncRecord[]>([]);
  const [session,setSession]=useState<FirebaseSession|null>(null),[config,setConfig]=useState<FirebaseConfig>({...bodyOsFirebaseConfig,webClientId:bodyOsGoogleWebClientId});
  const [message,setMessage]=useState('Loading local records…'),[busy,setBusy]=useState(false),[pending,setPending]=useState(0);
  const [draft,setDraft]=useState<Draft>(freshDraft),[exercise,setExercise]=useState(''),[weight,setWeight]=useState(''),[reps,setReps]=useState(''),[rir,setRir]=useState('');
  const [mode,setMode]=useState<ExerciseTrackingMode>('weight_reps'),[duration,setDuration]=useState(''),[rpe,setRpe]=useState(''),[setType,setSetType]=useState('work'),[side,setSide]=useState('both'),[tempo,setTempo]=useState(''),[rest,setRest]=useState('');
  const [readyIndex,setReadyIndex]=useState(0),[workIndex,setWorkIndex]=useState(0),[hydrated,setHydrated]=useState(false),[draftSaved,setDraftSaved]=useState(true);
  const writeQueue=useRef(Promise.resolve());
  const runLock=useRef(false);
  const [readyForm,setReadyForm]=useState<Record<string,string>>({}),[pain,setPain]=useState<boolean|null>(null);
  const [planName,setPlanName]=useState(''),[planExercises,setPlanExercises]=useState('');
  const [skinValues,setSkinValues]=useState<Record<string,string>>({}),[skinDone,setSkinDone]=useState({am:false,pm:false});
  const [reminders,setReminders]=useState<ReminderSettings>(defaultReminders);
  const [conflicts,setConflicts]=useState<Awaited<ReturnType<typeof listConflicts>>>([]);
  const [choices,setChoices]=useState<Record<string,SyncChoice>>({});
  const refresh=async()=> {setRecords(await listRecords());setPending((await pendingKeys()).size);setConflicts(await listConflicts());};
  useEffect(()=>{void (async()=>{try {
    await refresh();setSession(await savedSession());const savedConfig=await preference<FirebaseConfig>('firebaseConfig',bodyOsFirebaseConfig);setConfig({...bodyOsFirebaseConfig,...(savedConfig.apiKey?savedConfig:{}),webClientId:savedConfig.webClientId||bodyOsGoogleWebClientId});
    setOnboarded((await preference('onboardingVersion',0))>=1);
    setDraft(await preference('workoutDraft',freshDraft()));
    const entry=await preference('workoutEntry',{exercise:'',weight:'',reps:'',rir:''});setExercise(entry.exercise);setWeight(entry.weight);setReps(entry.reps);setRir(entry.rir);
    const advanced=await preference('workoutAdvanced',{mode:'weight_reps' as ExerciseTrackingMode,duration:'',rpe:'',setType:'work',side:'both',tempo:'',rest:''});setMode(advanced.mode);setDuration(advanced.duration);setRpe(advanced.rpe);setSetType(advanced.setType);setSide(advanced.side);setTempo(advanced.tempo);setRest(advanced.rest);
    const checkin=await preference(`readinessDraft:${localDateKey()}`,{values:{} as Record<string,string>,pain:null as boolean|null});setReadyForm(checkin.values);setPain(checkin.pain);setHydrated(true);
    setReminders(await preference('reminders',defaultReminders));setAutoSync(await preference('autoSync',true));
    setMessage('Local records loaded. Changes stay on this phone until you sync.');
  } catch(error) {setMessage(`Local storage failed: ${(error as Error).message}`);}})();},[]);
  useEffect(()=>{if(!hydrated)return;setDraftSaved(false);writeQueue.current=writeQueue.current.catch(()=>{}).then(async()=>{await setPreference('workoutEntry',{exercise,weight,reps,rir});await setPreference('workoutAdvanced',{mode,duration,rpe,setType,side,tempo,rest});await setPreference(`readinessDraft:${localDateKey()}`,{values:readyForm,pain});}).then(()=>setDraftSaved(true)).catch(()=>{setDraftSaved(false);setMessage('Draft save failed. Keep the app open and free device storage.');});},[hydrated,exercise,weight,reps,rir,readyForm,pain,mode,duration,rpe,setType,side,tempo,rest]);
  async function run(action:()=>Promise<void>) {if(runLock.current||!hydrated)return;runLock.current=true;setBusy(true);try{await action();}catch(error){setMessage((error as Error).message);Alert.alert('Body OS',(error as Error).message);}finally{runLock.current=false;setBusy(false);}}
  const sessions=records.filter(r=>r.entityType==='session'&&!r.deletedAt&&(r.payload as Session).status==='finished');
  const units=(records.find(r=>r.entityType==='profile'&&!r.deletedAt)?.payload as {units?:string}|undefined)?.units || 'kg';
  const weeks=records.filter(r=>r.entityType==='week'&&!r.deletedAt).map(r=>r.payload as Week);
  const ready=records.filter(r=>r.entityType==='readiness'&&!r.deletedAt).map(r=>r.payload as Readiness).find(r=>r.date===localDateKey());
  const health=records.filter(r=>r.entityType==='healthReading'&&!r.deletedAt).map(r=>r.payload as HealthReading);
  const healthDate=health.map(r=>r.date).sort().at(-1)||localDateKey();
  useEffect(()=>{if(tab!=='Care')return;const old=records.find(r=>r.entityType==='skinLog'&&!r.deletedAt&&(r.payload as SkinLog).date===localDateKey())?.payload as SkinLog|undefined;if(old){setSkinValues(Object.fromEntries(['barrier','hydration','oiliness','irritation'].map(key=>[key,String(old[key as keyof SkinLog])])));setSkinDone(old.routineDone);}},[tab]);
  useAutoSync(hydrated&&onboarded===true&&autoSync&&Boolean(session)&&session?.projectId===config.projectId,async()=>{
    if(!session)return;if(runLock.current)throw new Error('Waiting for the current action to finish.');
    const result=await syncNow(config,session);await refresh();setMessage(result.conflicts.length?`${result.conflicts.length} sync conflicts need review in More.`:`Synced: ${result.uploaded} uploaded · ${result.downloaded} downloaded.`);
  },setMessage);
  async function addSet() {
    if(!exercise.trim()) throw new Error('Enter an exercise name.');
    const parsed=parseWorkoutSet({s:1,w:weight,r:reps,durationSec:duration,rir:rir||undefined,rpe:rpe||undefined,type:setType,side,tempo,restSec:rest||undefined},mode);
    const logs=draft.logs.map(log=>({...log,sets:[...log.sets]}));let log=logs.find(l=>l.name===exercise.trim());
    if(!log){log=logFromPlan(exercise,draft.prescriptions?.find(p=>p.name===exercise.trim()));logs.push(log);}
    log.sets.push({...parsed,s:log.sets.length+1} as ExerciseLog['sets'][number]);
    const next={...draft,logs,setOrder:[...(draft.setOrder||[]),exercise.trim()]};await setPreference('workoutDraft',next);setDraft(next);setMessage('Set saved locally.');setWorkIndex(3);
    const seconds=Number(rest)>0?Number(rest):90;
    await setPreference('restEndsAt',Date.now()+seconds*1000);setRestVersion(v=>v+1);
    try{await startRest(seconds);}catch{setMessage('Set saved. Rest timer is running; notifications are unavailable.');}
  }
  function chooseExercise(name:string) {setExercise(name);const plan=draft.prescriptions?.find(p=>p.name===name);setMode(plan?.trackingMode||'weight_reps');setTempo(plan?.tempo||'');setRest(String(plan?.restSec??''));setWeight('');setReps('');setDuration('');setRir('');setRpe('');setSetType('work');setSide('both');}
  async function finishWorkout() {
    if(!draft.logs.length) throw new Error('Log at least one set before finishing.');
    sessionInputSchema.parse(draft);
    const now=new Date().toISOString();
    const payload:Session={...draft,status:'finished',createdAt:draft.startedAt,updatedAt:now,endedAt:now,weekId:draft.weekId||'mobile',weekName:draft.weekName||'Mobile workout',weekNumber:draft.weekNumber||1,dayKey:draft.dayKey||draft.id,dayTitle:draft.dayTitle||'Workout',name:String((records.find(r=>r.entityType==='profile'&&!r.deletedAt)?.payload as {displayName?:string}|undefined)?.displayName||'Athlete'),sleep:ready?.sleepHours??'',soreness:ready?.soreness??'',readiness:ready||null};
    await saveRecord({id:draft.id,entityType:'session',payload,updatedAt:now,revision:1,deviceId:await deviceId()});
    const next=freshDraft();await setPreference('workoutDraft',next);setDraft(next);setExercise('');setWeight('');setReps('');setRir('');setWorkIndex(0);setTab('Progress');await refresh();setMessage('Workout saved on this phone. Cloud sync is optional.');
  }
  async function saveReadiness() {
    if(pain===null)throw new Error('Choose Yes or No for pain before saving.');
    const result=normalizeReadiness({...readyForm,date:localDateKey(),painFlag:pain},records.filter(r=>r.entityType==='readiness'&&!r.deletedAt).map(r=>r.payload as Readiness));
    if(!result.item) throw new Error(result.error);
    const item={...result.item,id:ready?.id||`ready-${localDateKey()}`,weekId:ready?.weekId||'daily',dayKey:ready?.dayKey||localDateKey()};
    await saveRecord({id:item.id,entityType:'readiness',payload:item,updatedAt:new Date().toISOString(),revision:1,deviceId:await deviceId()});await refresh();setMessage('Readiness check-in saved on this phone.');setCheckingIn(false);
  }
  async function sync() {
    const next=session;
    if(!next) throw new Error('Continue with Google to connect your account first.');
    setSession(next);setMessage('Syncing your records… Keep the app open.');
    const result=await syncNow(config,next,choices,setMessage);setChoices({});await refresh();
    setMessage(`${result.uploaded} uploaded · ${result.downloaded} downloaded · ${result.conflicts.length} conflicts`);
  }
  async function googleLogin(){const next=await signInWithGoogle({...bodyOsFirebaseConfig,webClientId:bodyOsGoogleWebClientId});if(!next)return false;setConfig({...bodyOsFirebaseConfig,webClientId:bodyOsGoogleWebClientId});setSession(next);return true;}
  if(!hydrated||onboarded===null)return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.brand}>BODY OS</Text><Text style={styles.hero}>Your space is getting ready.</Text><Text style={styles.muted}>{message}</Text></View></SafeAreaView>;
  if(!onboarded)return <Onboarding records={records} connected={Boolean(session)} onGoogle={googleLogin} onComplete={async()=>{await refresh();setOnboarded(true);}}/>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={styles.brand}>BODY OS <Text style={styles.muted}> / 4.0</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="Account and settings" onPress={()=>setTab('More')} style={styles.ratingButton}><Text style={styles.value}>◎</Text></Pressable></View>
    <Text style={styles.hero}>{tab==='Today'?'Your next good day.':tab==='Tracker'?'Let’s get stronger.':tab==='More'?'Your space.':tabLabels[tab]}</Text><Text style={styles.muted}>{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</Text>
    <View style={styles.status}><Text accessibilityLiveRegion="polite" style={styles.muted}>{message}</Text><Text style={styles.muted}>{draftSaved?'Saved on this phone':'Saving draft…'} · {session?`${pending} pending sync`:'Offline mode'}</Text></View>
    {(tab==='Tracker'||tab==='Plan')&&<View style={{flexDirection:'row',gap:12}}><Button title="Workout" onPress={()=>setTab('Tracker')}/><Button title="Plans & library" onPress={()=>setTab('Plan')}/></View>}
    {tab==='Today'&&<>

      <Section title="Today"><Text style={styles.value}>{ready?`Estimated readiness ${ready.score}/100`:'Recovery check-in not recorded'}</Text><Text style={styles.muted}>{ready?.assistant?.reason || 'Record how you feel before reviewing your training effort.'}</Text><Button title={draft.logs.length?'Resume workout':'Start workout'} onPress={()=>setTab('Tracker')} /></Section>
      <Button title={checkingIn?"Close check-in":ready?"Review today’s check-in":"Start readiness check-in"} onPress={()=>setCheckingIn(!checkingIn)}/>
      {checkingIn&&<FlashDeck label="READINESS" index={readyIndex} onChange={setReadyIndex} canNext={readyIndex===7?pain!==null:readyIndex>7 || (readyForm[readyQuestions[readyIndex][0]]!==undefined && readyForm[readyQuestions[readyIndex][0]]!=='' && Number.isFinite(Number(readyForm[readyQuestions[readyIndex][0]])) && Number(readyForm[readyQuestions[readyIndex][0]])>=(readyIndex===0?0:1) && Number(readyForm[readyQuestions[readyIndex][0]])<=(readyIndex===0?24:10))}>
        {readyQuestions.map(([key,title,hint],i)=><View key={key} style={styles.stack}><Text style={styles.orb}>{['☾','✦','◌','ϟ','≈','↗','☺'][i]}</Text><Text style={styles.cardHeadline}>{title}</Text><Text style={styles.muted}>{hint}</Text><Field label={i===0?'Sleep hours':'Your answer'} numeric value={readyForm[key]||''} onChange={v=>setReadyForm({...readyForm,[key]:v})}/>{i>0&&<View style={styles.rating}>{Array.from({length:10},(_,j)=><Pressable key={j} accessibilityRole="button" accessibilityState={{selected:Number(readyForm[key])===j+1}} accessibilityLabel={`${title} ${j+1}`} style={[styles.ratingButton,Number(readyForm[key])===j+1&&styles.ratingSelected]} onPress={()=>setReadyForm({...readyForm,[key]:String(j+1)})}><Text style={styles.value}>{j+1}</Text></Pressable>)}</View>}</View>)}
        <View style={styles.stack}><Text style={styles.orb}>◎</Text><Text style={styles.cardHeadline}>Listen to your body.</Text><Text style={styles.muted}>Pain or injury flagged</Text><Button title={pain===true?'✓ Yes':'Yes'} onPress={()=>setPain(true)}/><Button title={pain===false?'✓ No':'No'} onPress={()=>setPain(false)}/><Field label="Resting heart rate (optional, bpm)" numeric value={readyForm.restingHeartRate||''} onChange={v=>setReadyForm({...readyForm,restingHeartRate:v})}/><Field label="Notes (optional)" value={readyForm.notes||''} onChange={v=>setReadyForm({...readyForm,notes:v})}/><Text style={styles.muted}>Flag pain so the training guidance can account for it.</Text></View>
        <View style={styles.stack}><Text style={styles.cardHeadline}>Your check-in.</Text>{readyQuestions.map(([key,title])=><Text key={key} style={styles.muted}>{title} · {readyForm[key]||'Not recorded'}</Text>)}<Text style={styles.muted}>Pain flagged: {pain===null?'Not answered':pain?'Yes':'No'} · Readiness is an estimate.</Text><Button title="Save check-in" disabled={busy} onPress={()=>void run(saveReadiness)}/></View>
      </FlashDeck>}
      <FeatureMenu labels={["Training coach","Daily guidance"]}><AiCoach records={records} onSaved={refresh}/><LocalCoach records={records}/></FeatureMenu>
    </>}
    {tab==='Tracker'&&<>
      <WorkoutTools records={records} exercise={exercise} units={units==='lb'?'lb':'kg'} onWarmup={(w,r)=>{setWeight(w);setReps(r);setMode('weight_reps');setSetType('warmup');setWorkIndex(2);}}/>
      <RestTimer refreshToken={restVersion} defaultSeconds={Number(rest)>0&&Number(rest)<=86400?Number(rest):90}/>
      <FlashDeck label={draft.dayTitle||'WORKOUT'} index={workIndex} onChange={setWorkIndex} canNext={workIndex===0?Boolean(exercise.trim()):workIndex===1?(mode==='time'?Number(duration)>0:Number(reps)>0&&(mode==='reps'||weight.trim()!==''&&Number.isFinite(Number(weight))&&Number(weight)>=0)):true}>
       <View style={styles.stack}><Text style={styles.orb}>↗</Text><Text style={styles.cardHeadline}>Choose your movement.</Text><Field label="Exercise" value={exercise} onChange={setExercise}/><Text style={styles.muted}>Use a saved plan or name your own movement.</Text>{Array.from(new Set([...(draft.planned||[]),...draft.logs.map(l=>l.name)])).map(name=><Button key={name} title={name} onPress={()=>chooseExercise(name)}/>)}</View>
       <View style={styles.stack}><Text style={styles.muted}>{exercise}</Text><Text style={styles.cardHeadline}>Make this set count.</Text><Text style={styles.muted}>{draft.prescriptions?.find(p=>p.name===exercise)?.vol} · {draft.prescriptions?.find(p=>p.name===exercise)?.cue}</Text><SetEntry mode={mode} onMode={setMode} weight={weight} onWeight={setWeight} reps={reps} onReps={setReps} duration={duration} onDuration={setDuration} units={units}/><Text style={styles.muted}>Swipe back to review. Moving cards does not log a set.</Text></View>
       <View style={styles.stack}><Text style={styles.cardHeadline}>How much was left?</Text><Text style={styles.muted}>{exercise} · {mode==='time'?`${duration} sec`:mode==='reps'?`${reps} reps`:`${weight} ${units} × ${reps}`}</Text><Field label="Reps in reserve (optional)" value={rir} onChange={setRir} numeric/><Field label="RPE (optional, 1–10)" value={rpe} onChange={setRpe} numeric/>{['warmup','work','amrap','drop','failure','backoff'].map(t=><Button key={t} title={`${setType===t?'✓ ':''}${t}`} onPress={()=>setSetType(t)}/>)}{['both','L','R'].map(v=><Button key={v} title={`${side===v?'✓ ':''}${v==='both'?'Both sides':v==='L'?'Left':'Right'}`} onPress={()=>setSide(v)}/>)}<Field label="Tempo (optional)" value={tempo} onChange={setTempo}/><Field label="Rest (seconds, optional)" value={rest} onChange={setRest} numeric/><Button title="Save set locally" disabled={busy} onPress={()=>void run(addSet)}/></View>
       <View style={styles.stack}><Text style={styles.cardHeadline}>Your session so far.</Text>{draft.logs.map(log=><Text key={log.name} style={styles.muted}>{log.name}: {log.sets.map(s=>formatWorkoutSet(s,units)).join(' · ')}</Text>)}<Button title="Another set" onPress={()=>setWorkIndex(1)}/><Button title="Change exercise" onPress={()=>setWorkIndex(0)}/><Button title="Undo last saved set" disabled={busy||!draft.logs.length} onPress={()=>void run(async()=>{const logs=draft.logs.map(l=>({...l,sets:[...l.sets]}));const lastName=draft.setOrder?.at(-1);const idx=lastName?logs.findIndex(l=>l.name===lastName):logs.length-1;if(idx<0)throw new Error('Cannot identify the last set.');logs[idx].sets.pop();if(!logs[idx].sets.length)logs.splice(idx,1);const next={...draft,logs,setOrder:draft.setOrder?.slice(0,-1)};await setPreference('workoutDraft',next);setDraft(next);})}/><Button title="Finish workout" disabled={busy||!draft.logs.length} onPress={()=>Alert.alert('Finish workout?','Save these sets to your workout history.',[{text:'Keep training',style:'cancel'},{text:'Save workout',onPress:()=>void run(finishWorkout)}])}/></View>
      </FlashDeck>
    </>}
    {tab==='Plan'&&<FeatureMenu labels={['Programs','Calendar & schedule','Exercise library','Plan editor','Saved splits','Start a saved workout']}><ProgramManager records={records} onSaved={refresh}/><RecordManager spec={scheduleSpec} records={records} onSaved={refresh}/><ExerciseLibrary records={records} onSaved={refresh}/><PlanEditor records={records} onSaved={refresh}/><PlanEditor records={records} onSaved={refresh} entityType="librarySplit"/><Section title="Saved plans">{weeks.length?weeks.map(week=><View key={week.id}><Text style={styles.value}>{week.name}</Text>{week.days.map(day=><View key={day.key} style={styles.stack}><Text style={styles.muted}>{day.title}: {day.exercises.map(e=>`${e.name} (${e.vol})`).join(', ')}</Text><Button title={`Train ${day.title}`} disabled={busy||!day.exercises.length} onPress={()=>void run(async()=>{if(draft.logs.length||exercise.trim())throw new Error('Finish the current draft before starting another plan.');const next={...freshDraft(),weekId:week.id,weekName:week.name,weekNumber:week.weekNumber,dayKey:day.key,dayTitle:day.title,planned:day.exercises.map(e=>e.name),prescriptions:day.exercises.map(e=>({...e}))};await setPreference('workoutDraft',next);setDraft(next);setExercise(day.exercises[0].name);setMode(day.exercises[0].trackingMode||'weight_reps');setTempo(day.exercises[0].tempo||'');setRest(String(day.exercises[0].restSec??''));setWorkIndex(0);setTab('Tracker');})}/></View>)}</View>):<Text style={styles.muted}>Create a local plan above, or optionally sync existing desktop plans.</Text>}</Section></FeatureMenu>}
    {tab==='Progress'&&<FeatureMenu labels={['Reports','Analytics',...progressSpecs.map(spec=>spec.title),'Workout history','Health Connect']}>
      <ReportTools records={records}/>
      <ProgressAnalysis records={records} units={units}/>
      {progressSpecs.map(spec=><RecordManager key={spec.type} spec={spec} records={records} onSaved={refresh}/>)}
      <WorkoutHistory records={records} units={units} onSaved={refresh}/>
      <Section title="Health Connect"><Text style={styles.muted}>Read steps, sleep-session duration, and resting heart rate from permitted Android apps. Readings stay separate from manual check-ins. Sleep-session duration is not a measurement of time asleep.</Text><Button title="Import last 7 days" disabled={busy} onPress={()=>void run(async()=>{const result=await importHealthReadings();await refresh();setMessage(`${result.imported} imported · ${result.unchanged} unchanged · ${result.skipped} skipped${result.denied.length?` · Not permitted: ${result.denied.join(', ')}`:''}`);})}/><Text style={styles.muted}>Latest recorded date: {healthDate}</Text>{summarizeHealth(health,healthDate).map(v=><Text key={`${v.kind}:${v.source}`} style={styles.muted}>{v.kind}: {v.value==null?'Overlapping or multi-day records — review source':`${v.value.toFixed(1)} ${v.unit}`} · {v.source}</Text>)}</Section>
    </FeatureMenu>}
    {tab==='Care'&&<FeatureMenu labels={['Skin coach','Skin guidance','Routine editor',...careSpecs.map(spec=>spec.title),'Care overview',...(records.some(r=>r.entityType==='skinRoutine'&&!r.deletedAt)?records.filter(r=>r.entityType==='skinRoutine'&&!r.deletedAt).map(r=>(r.payload as SkinRoutine).name):defaultSkinRoutines().map(r=>r.name)),'Skin check-in']}>
      <AiCoach records={records} onSaved={refresh} skin/>
      <LocalCoach records={records} skin/>
      <RoutineEditor records={records} onSaved={refresh}/>
      {careSpecs.map(spec=><RecordManager key={spec.type} spec={spec} records={records} onSaved={refresh}/>)}
      <Section title="Your daily rituals"><Text style={styles.cardHeadline}>A little consistency.</Text><Text style={styles.muted}>Review your saved routines. Completion and skin observations are recorded only when you save.</Text></Section>
      {(records.some(r=>r.entityType==='skinRoutine'&&!r.deletedAt)?records.filter(r=>r.entityType==='skinRoutine'&&!r.deletedAt).map(r=>r.payload as SkinRoutine):defaultSkinRoutines()).map(routine=><Section key={routine.id} title={routine.name}>{routine.steps.filter(step=>!step.paused).map((step,i)=><Text key={step.id} style={styles.value}>{i+1}. {step.label}{step.waitMin?` · wait ${step.waitMin} min`:''}</Text>)}<Text style={styles.muted}>Completed {routine.slot.toUpperCase()} today</Text><Switch accessibilityLabel={`${routine.slot} routine completed`} value={skinDone[routine.slot]} onValueChange={value=>setSkinDone({...skinDone,[routine.slot]:value})}/></Section>)}
      <Section title="Skin check-in">{['barrier','hydration','oiliness','irritation'].map(key=><Field key={key} label={`${key} (1–10)`} value={skinValues[key]||''} numeric onChange={v=>setSkinValues({...skinValues,[key]:v})}/>)}<Text style={styles.muted}>Hydration here means skin hydration. Record your observations; these are not diagnostic measurements.</Text><Button title="Save skin check-in" disabled={busy} onPress={()=>void run(async()=>{for(const key of ['barrier','hydration','oiliness','irritation'])if(!skinValues[key]||!Number.isFinite(Number(skinValues[key]))||Number(skinValues[key])<1||Number(skinValues[key])>10)throw new Error(`Enter ${key} from 1 to 10.`);const existing=records.find(r=>r.entityType==='skinLog'&&!r.deletedAt&&(r.payload as SkinLog).date===localDateKey());const previous=existing?.payload as SkinLog|undefined;const now=new Date().toISOString();const item:SkinLog={...previous,id:previous?.id||`skin-${localDateKey()}`,date:localDateKey(),barrier:Number(skinValues.barrier),hydration:Number(skinValues.hydration),oiliness:Number(skinValues.oiliness),irritation:Number(skinValues.irritation),concerns:previous?.concerns||[],notes:previous?.notes||'',routineDone:skinDone,createdAt:previous?.createdAt||now};await saveRecord({id:item.id,entityType:'skinLog',payload:item,updatedAt:now,revision:1,deviceId:await deviceId()});await refresh();setMessage('Skin check-in saved locally.');})}/></Section>
    </FeatureMenu>}
    {tab==='More'&&<FeatureMenu labels={['Backups & restore','Profile & units','Google account & sync',...conflicts.map(c=>'Review conflict: '+c.key),'Reminders']}>
      <BackupTools onSaved={refresh}/>
      <RecordManager spec={profileSpec} records={records} onSaved={refresh}/>
      <Section title="Optional cloud sync"><Text style={styles.muted}>Sync automatically after changes and when reopening the app</Text><Switch accessibilityLabel="Automatic sync" value={autoSync} onValueChange={value=>void run(async()=>{await setPreference('autoSync',value);setAutoSync(value);})}/><Text style={styles.muted}>Automatic transfers are grouped to limit cloud reads. Use Sync now for an immediate check.</Text><Text style={styles.muted}>Body OS works without an account. Use only Firebase Spark if you want cloud sync without enabling billing.</Text>{!session?<Button title="Continue with Google" disabled={busy} onPress={()=>void run(async()=>{if(await googleLogin())setMessage('Google connected. Your records are ready to sync.');})}/>:<><Text style={styles.value}>Google account connected</Text><Button title="Sign out · keep local data" disabled={busy} onPress={()=>void run(async()=>{await signOut();setSession(null);setMessage('Signed out. Your records remain on this phone.');})}/></>}<Button title="Sync now" disabled={busy||!session} onPress={()=>void run(sync)}/></Section>
      {conflicts.map(c=><Section key={c.key} title={`Conflict: ${c.key}`}><Text style={styles.muted}>Phone: {JSON.stringify(c.local.payload)}{c.local.deletedAt?' (deleted)':''}</Text><Text style={styles.muted}>Cloud: {JSON.stringify(c.remote.payload)}{c.remote.deletedAt?' (deleted)':''}</Text><Button title={choices[c.key]?.side==='local'?'Selected: phone version':'Keep phone version'} onPress={()=>setChoices({...choices,[c.key]:{side:'local',cloudVersion:c.remote.cloudVersion!,localToken:contentToken(c.local)}})}/><Button title={choices[c.key]?.side==='remote'?'Selected: cloud version':'Keep cloud version'} onPress={()=>setChoices({...choices,[c.key]:{side:'remote',cloudVersion:c.remote.cloudVersion!,localToken:contentToken(c.local)}})}/><Text style={styles.muted}>Sync again to apply your choice.</Text></Section>)}
      <Section title="Reminders"><Text style={styles.muted}>Enable workout and skincare reminders</Text><Switch value={reminders.enabled} onValueChange={enabled=>setReminders({...reminders,enabled})}/>{(['workout','skincare','quietStart','quietEnd'] as const).map(key=><Field key={key} label={`${key} (HH:MM)`} value={reminders[key]} onChange={v=>setReminders({...reminders,[key]:v})}/>)}<Text style={styles.muted}>Reminders inside quiet hours move to the end of quiet hours.</Text><Button title="Save reminders" disabled={busy} onPress={()=>void run(async()=>{await configureReminders(reminders);setMessage('Reminder schedule saved.');})}/></Section>
    </FeatureMenu>}
  </ScrollView><View style={styles.nav}>{tabs.map(t=><Pressable accessibilityRole="button" key={t} onPress={()=>setTab(t)} style={[styles.navItem,(tab===t||(t==='Tracker'&&tab==='Plan'))&&styles.navActive]}><Text style={[styles.muted,(tab===t||(t==='Tracker'&&tab==='Plan'))&&{color:'#9EEA22',fontWeight:'700'}]}>{tabLabels[t]}</Text></Pressable>)}</View></SafeAreaView>;
}
const styles=StyleSheet.create({status:{backgroundColor:'#17191F',padding:14,borderRadius:16,gap:4},brand:{color:'#9EEA22',fontWeight:'800',fontSize:12,letterSpacing:3},stack:{gap:16},cardHeadline:{color:'#F6F7F8',fontSize:29,fontWeight:'700',letterSpacing:-.8},orb:{color:'#9EEA22',fontSize:46},rating:{flexDirection:'row',flexWrap:'wrap',gap:8},ratingButton:{width:'17%',minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:'#232A35'},ratingSelected:{borderWidth:2,borderColor:'#9EEA22'},safe:{flex:1,backgroundColor:'#101115'},content:{padding:20,gap:14,paddingBottom:30},hero:{color:'#F6F7F8',fontSize:36,fontWeight:'800',letterSpacing:-1.4},muted:{color:'#A7ADB7',fontSize:14,lineHeight:20},card:{backgroundColor:'#17191F',borderColor:'#2C3038',borderWidth:1,borderRadius:18,padding:16,gap:10},cardTitle:{color:'#9EEA22',fontWeight:'800',fontSize:14},value:{color:'#F6F7F8',fontSize:18,fontWeight:'700'},primary:{alignItems:'center',backgroundColor:'#9EEA22',borderRadius:14,padding:15},primaryText:{color:'#111',fontWeight:'800'},input:{backgroundColor:'#11141A',borderColor:'#2C3038',borderWidth:1,borderRadius:12,color:'#F6F7F8',padding:13},nav:{backgroundColor:'#11141A',flexDirection:'row',padding:8},navItem:{alignItems:'center',flex:1,paddingVertical:10},navActive:{backgroundColor:'#242E18',borderRadius:10}});
