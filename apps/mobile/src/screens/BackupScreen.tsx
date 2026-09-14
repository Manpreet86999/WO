import {useEffect,useRef,useState} from 'react';
import {Alert} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {File,Paths} from 'expo-file-system';
import {Action,Card,Destination,Heading,Kicker,Label,Page,Row} from '../ui/kit';
import {downloadDriveBackup,listDriveBackups,type DriveBackup,uploadDriveBackup} from '../lib/drive-backup';
import {listRecords,preference,restoreRecords,setPreference} from '../lib/store';
import {parseMobileBackup} from '../../../../src/shared/mobile-backup';
import {sessionsToCsv} from '../../../../src/shared/training';
import type {Session} from '../../../../src/shared/types';

async function makeBackup(prefix:string){
  const file=new File(Paths.document,`${prefix}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  file.create();
  file.write(JSON.stringify({format:'body-os-mobile',version:1,createdAt:new Date().toISOString(),account:await preference('syncAccount',''),records:await listRecords()}));
  return file;
}
async function share(file:File,mimeType:string){if(!await Sharing.isAvailableAsync())throw new Error('File sharing is not available on this phone.');await Sharing.shareAsync(file.uri,{mimeType});}

export function BackupScreen(){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[safety,setSafety]=useState(''),[drive,setDrive]=useState<DriveBackup[]>([]),lock=useRef(false);
  useEffect(()=>{void preference('lastRestoreSafetyCopy','').then(setSafety);},[]);
  async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);try{await work();}catch(e){setMessage((e as Error).message);}finally{lock.current=false;setBusy(false);}}
  async function review(text:string){
    const backup=parseMobileBackup(text),[current,account]=await Promise.all([listRecords(),preference('syncAccount','')]);
    if(account&&backup.account&&backup.account!==account)throw new Error('This backup belongs to a different Google account.');
    const duplicates=backup.records.filter(record=>current.some(existing=>existing.id===record.id&&existing.entityType===record.entityType)).length;
    Alert.alert('Restore this reviewed backup?',`${backup.records.length} records found. ${duplicates} existing records will be replaced. Other records stay on this phone. A safety copy is created before restoring.`,[
      {text:'Cancel',style:'cancel'},
      {text:'Restore',style:'destructive',onPress:()=>void run(async()=>{const before=await makeBackup('before-restore');await setPreference('lastRestoreSafetyCopy',before.uri);setSafety(before.uri);await restoreRecords(backup.records,backup.account);setMessage(`Restored ${backup.records.length} records. Safety copy ready to export.`);})},
    ]);
  }
  return <Page><Kicker>Recovery & portability</Kicker><Heading>Backup Center</Heading><Card accent><Heading size={23}>Your records stay yours.</Heading><Label>Backups contain your Body OS records, never Google login tokens, provider keys or signing keys.</Label></Card>
    <Card><Kicker>Local copy</Kicker><Heading size={22}>Export a full backup</Heading><Label muted>Create a portable JSON copy before moving phone, restoring data or testing an update.</Label><Action title={busy?'Working…':'Export backup'} disabled={busy} icon="shield" onPress={()=>void run(async()=>{const file=await makeBackup('body-os-backup');await share(file,'application/json');setMessage('Backup created. Save it outside Body OS.');})}/></Card>
    <Card><Kicker>Restore</Kicker><Heading size={22}>Review before restoring</Heading><Label muted>Select a Body OS backup. You see its record count and account context before anything changes.</Label><Action secondary title="Choose backup to review" disabled={busy} onPress={()=>void run(async()=>{const result=await DocumentPicker.getDocumentAsync({type:['application/json','text/plain'],copyToCacheDirectory:true});if(result.canceled)return;const picked=result.assets[0];if((picked.size||0)>25*1024*1024)throw new Error('Backup exceeds the 25 MB import limit.');await review(await new File(picked.uri).text());})}/>{safety!==''&&<Action secondary title="Export last safety copy" disabled={busy} onPress={()=>void run(async()=>share(new File(safety),'application/json'))}/>}</Card>
    <Card><Kicker>Spreadsheet export</Kicker><Heading size={22}>Workout sets CSV</Heading><Label muted>Export actual completed workout data for a spreadsheet or your own analysis.</Label><Action secondary title="Export workout CSV" disabled={busy} onPress={()=>void run(async()=>{const sessions=(await listRecords()).filter(r=>r.entityType==='session'&&!r.deletedAt).map(r=>r.payload as Session);const file=new File(Paths.cache,`body-os-workouts-${Date.now()}.csv`);file.create();file.write(sessionsToCsv(sessions));await share(file,'text/csv');setMessage(`${sessions.length} workout records prepared as CSV.`);})}/></Card>
    <Card><Kicker>Optional off-phone copy</Kicker><Heading size={22}>Google Drive app-data backup</Heading><Label muted>Uses your Google account’s private Body OS app-data folder. Enable the Google Drive API for the Firebase project before connecting it.</Label><Action secondary title="Back up to Drive" disabled={busy} onPress={()=>void run(async()=>{const file=await makeBackup('body-os-backup');const uploaded=await uploadDriveBackup(await file.text());setMessage(`Saved to Drive: ${uploaded.name}`);})}/><Action secondary title="Browse Drive backups" disabled={busy} onPress={()=>void run(async()=>{const files=await listDriveBackups();setDrive(files);setMessage(files.length?`${files.length} Drive backups found.`:'No Drive backups found.');})}/></Card>
    {drive.map(file=><Destination key={file.id} title={file.name} detail={`${new Date(file.createdTime).toLocaleString()}${file.size?` · ${Math.round(Number(file.size)/1024)} KB`:''}`} onPress={()=>void run(async()=>review(await downloadDriveBackup(file)))}/>)}
    {message!==''&&<Card><Label>{message}</Label></Card>}<Label muted size={12}>A restore validates the file, checks account context and writes all records in one operation. A failed restore does not apply a partial backup.</Label></Page>;
}
