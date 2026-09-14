import { useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { SyncRecord } from '../../../../src/shared/sync';
import { snapshotFromRecords } from '../../../../src/shared/record-snapshot';
import { reportHtml } from '../../../../src/shared/report-html';
export function ReportTools({records}:{records:SyncRecord[]}) {
  const [busy,setBusy]=useState(false),[show,setShow]=useState(false),lock=useRef(false);
  const db=snapshotFromRecords(records);
  async function generate(kind:'progress'|'session'|'week',id?:string){if(lock.current)return;lock.current=true;setBusy(true);try{const html=reportHtml(db,kind,id);const file=await Print.printToFileAsync({html});if(!await Sharing.isAvailableAsync())throw new Error('File sharing is unavailable on this device.');await Sharing.shareAsync(file.uri,{mimeType:'application/pdf'});}catch(error){Alert.alert('Report could not be created',(error as Error).message);}finally{lock.current=false;setBusy(false);}}
  const button=(label:string,kind:'progress'|'session'|'week',id?:string)=><Pressable accessibilityRole="button" key={`${kind}-${id||'all'}`} disabled={busy} style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={()=>void generate(kind,id)}><Text style={{color:'#F6F7F8'}}>{label}</Text></Pressable>;
  return <View style={{padding:16,gap:10,backgroundColor:'#17191F',borderRadius:18}}><Text style={{color:'#9EEA22',fontSize:20}}>PDF reports</Text>{button(busy?'Preparing report…':'Export progress PDF','progress')}<Pressable accessibilityRole="button" style={{padding:14}} onPress={()=>setShow(!show)}><Text style={{color:'#F6F7F8'}}>{show?'Hide':'Choose'} session or week report</Text></Pressable>{show&&<>{db.weeks.map(w=>button(`Week: ${w.name}`,'week',w.id))}{db.sessions.filter(s=>s.status==='finished').sort((a,b)=>b.date.localeCompare(a.date)).map(s=>button(`${s.date} · ${s.dayTitle}`,'session',s.id))}</>}</View>;
}
