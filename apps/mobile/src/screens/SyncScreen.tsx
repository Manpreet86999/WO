import {useCallback,useRef,useState} from 'react';
import {Switch,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Action,Card,Destination,Heading,Kicker,Label,Metric,Page,Row} from '../ui/kit';
import {useNav} from '../navigation/routes';
import {useBody} from '../state/BodyProvider';
import {pendingKeys,preference,setPreference,subscribePreferences} from '../lib/store';
import {previewSync,savedSession,syncNow,type FirebaseSession} from '../lib/firebase-sync';
import {bodyOsFirebaseConfig} from '../../../../src/shared/firebase-config';

export function DeviceSyncScreen(){
 const nav=useNav(),{refresh}=useBody(),lock=useRef(false);
 const [session,setSession]=useState<FirebaseSession|null>(null),[pending,setPending]=useState(0),[last,setLast]=useState(''),[auto,setAuto]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState<Awaited<ReturnType<typeof previewSync>>|null>(null);
 const status=useCallback(async()=>{const [s,p,l,a,m]=await Promise.all([savedSession(),pendingKeys(),preference('lastSync',''),preference('autoSync',false),preference('syncStatus','Ready when you are.')]);setSession(s);setPending(p.size);setLast(l);setAuto(a);setMessage(m);},[]);
 useFocusEffect(useCallback(()=>{void status().catch(e=>setMessage(e.message));return subscribePreferences(key=>{if(key==='lastSync'||key==='syncStatus')void status().catch(e=>setMessage(e.message));});},[status]));
 async function perform(){
  if(lock.current)return;lock.current=true;setBusy(true);
  try{
   const current=await savedSession();if(!current)throw new Error('Sign in with Google first.');
   if(!await preference('lastSync','')&&!preview){setMessage('Reading both devices before making changes…');setPreview(await previewSync(bodyOsFirebaseConfig,current));setMessage('Review your first merge below. No records have been transferred.');return;}
   const result=await syncNow(bodyOsFirebaseConfig,current,{},setMessage);
   setPreview(null);await refresh();await status();
   const resultMessage=`${result.uploaded} uploaded · ${result.downloaded} downloaded · ${result.conflicts.length} conflicts to review`;
   setMessage(resultMessage);await setPreference('syncStatus',resultMessage);
  }catch(e){setMessage((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 return <Page><Kicker>Shared across your devices</Kicker><Heading>Device Sync</Heading><Card accent><Kicker>{busy?'Working':session?'Google connected':'Offline space'}</Kicker><Heading size={23}>{busy?'Connecting your records':'Your devices, together'}</Heading><Label>{message}</Label></Card><Card><Row><Metric title="Pending records" value={pending}/><Metric title="Connection" value={session?'Signed in':'Offline'}/></Row><Label muted>Last successful sync: {last?new Date(last).toLocaleString():'Not yet synced'}</Label></Card>
 {preview!=null&&<Card><Kicker>First sync review</Kicker><Heading size={22}>Review before merging</Heading><Row><Metric title="On this device" value={preview.local}/><Metric title="In your account" value={preview.cloud}/></Row><Label>{preview.upload} to upload · {preview.download} to download · {preview.conflict} conflicts</Label><Label muted>Conflicting edits stay unresolved until you choose a version. Counts may change if another device saves new records before you continue.</Label><Action title="Merge these records" disabled={busy} onPress={()=>void perform()}/><Action title="Cancel review" secondary disabled={busy} onPress={()=>{setPreview(null);setMessage('First sync cancelled. Local records are unchanged.');}}/></Card>}
 <Card><Row><View style={{flex:1}}><Label>Automatic foreground sync</Label><Label muted size={12}>Groups changes while using the app, after your first reviewed sync.</Label></View><Switch accessibilityLabel="Automatic sync" value={auto} onValueChange={v=>void setPreference('autoSync',v).then(()=>setAuto(v)).catch(e=>setMessage(e.message))}/></Row></Card>
 {session?!preview&&<Action title={busy?'Working…':last?'Sync now':'Review first sync'} disabled={busy} onPress={()=>void perform()}/>:<Action title="Continue with Google" onPress={()=>nav.navigate('Account')}/>}
 <Destination title="Review conflicts" detail="Choose which version to keep" onPress={()=>nav.navigate('Conflicts')}/><Label muted size={12}>Cloud quota or connection failures leave local records usable. Background sync is not guaranteed.</Label></Page>;
}
