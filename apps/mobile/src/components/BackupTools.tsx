import { uploadDriveBackup, listDriveBackups, downloadDriveBackup, type DriveBackup } from '../lib/drive-backup';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { parseMobileBackup } from '../../../../src/shared/mobile-backup';
import { sessionsToCsv } from '../../../../src/shared/training';
import type { Session } from '../../../../src/shared/types';
import { listRecords, preference, restoreRecords, setPreference } from '../lib/store';

export function BackupTools({onSaved}:{onSaved:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [safetyUri,setSafetyUri]=useState('');
  const [driveFiles,setDriveFiles]=useState<DriveBackup[]>([]);
  useEffect(()=>{void preference('lastRestoreSafetyCopy','').then(setSafetyUri);},[]);
  async function writeBackup(prefix:string){const file=new File(Paths.document,`${prefix}-${Date.now()}.json`);file.create();file.write(JSON.stringify({format:'body-os-mobile',version:1,createdAt:new Date().toISOString(),account:await preference('syncAccount',''),records:await listRecords()}));return file;}
  async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);try{await action();}catch(error){Alert.alert('File operation failed',(error as Error).message);}finally{setBusy(false);}}
  async function share(file:File,mimeType:string){if(!await Sharing.isAvailableAsync())throw new Error('File sharing is unavailable on this device.');await Sharing.shareAsync(file.uri,{mimeType});}
  async function reviewText(text:string){
    const backup=parseMobileBackup(text);const current=await listRecords();const duplicates=backup.records.filter(r=>current.some(c=>c.id===r.id&&c.entityType===r.entityType)).length;const account=await preference('syncAccount','');if(account&&backup.account&&account!==backup.account)throw new Error('This backup belongs to another cloud account.');
    confirmRestore(backup,duplicates);
  }
  async function preview(){const result=await DocumentPicker.getDocumentAsync({type:['application/json','text/plain'],copyToCacheDirectory:true});if(result.canceled)return;const asset=result.assets[0];if((asset.size||0)>25*1024*1024)throw new Error('Backup exceeds 25 MB.');const backup=parseMobileBackup(await new File(asset.uri).text());const current=await listRecords();const duplicates=backup.records.filter(r=>current.some(c=>c.id===r.id&&c.entityType===r.entityType)).length;const account=await preference('syncAccount','');if(account&&backup.account&&account!==backup.account)throw new Error('This backup belongs to another cloud account.');
    confirmRestore(backup,duplicates);
  }
  function confirmRestore(backup:ReturnType<typeof parseMobileBackup>,duplicates:number){
    Alert.alert('Restore reviewed backup?',`${backup.records.length} records; ${duplicates} existing records will be replaced by the backup versions. Other records remain. A safety copy is saved on this phone first.`,[{text:'Cancel',style:'cancel'},{text:'Restore',onPress:()=>void run(async()=>{const safety=await writeBackup('before-restore');await setPreference('lastRestoreSafetyCopy',safety.uri);setSafetyUri(safety.uri);await restoreRecords(backup.records,backup.account);await onSaved();setMessage(`Restored ${backup.records.length} records. Safety copy: ${safety.name}`);})}]);
  }
  return <View style={{padding:16,gap:10,backgroundColor:'#17191F',borderRadius:18}}><Text style={{color:'#9EEA22',fontSize:20}}>Backups and export</Text><Text style={{color:'#A7ADB7'}}>Back up saved records before changing phones. Export excludes passwords and login tokens. An unfinished workout and device reminder settings are not included yet.</Text>
    {[['Export backup',()=>run(async()=>{const file=await writeBackup('body-os-backup');await share(file,'application/json');setMessage('Backup created. Save a copy outside this app.');})],['Restore backup',()=>run(preview)],['Export workouts CSV',()=>run(async()=>{const sessions=(await listRecords()).filter(r=>r.entityType==='session'&&!r.deletedAt).map(r=>r.payload as Session);const file=new File(Paths.cache,`body-os-workouts-${Date.now()}.csv`);file.create();file.write(sessionsToCsv(sessions));await share(file,'text/csv');})]] .map(([label,action])=><Pressable accessibilityRole="button" key={String(label)} disabled={busy} style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={()=>void (action as ()=>Promise<void>)()}><Text style={{color:'#F6F7F8'}}>{String(label)}</Text></Pressable>)}
    <Text style={{color:'#A7ADB7'}}>Google Drive backups use Body OS's own app-data folder. Enable the Drive API for your Google project before connecting.</Text>
    <Pressable accessibilityRole="button" disabled={busy} style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={()=>void run(async()=>{const file=await writeBackup('body-os-backup');const uploaded=await uploadDriveBackup(await file.text());setMessage(`Saved to Drive: ${uploaded.name}`);})}><Text style={{color:'#F6F7F8'}}>Back up to Google Drive</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={()=>void run(async()=>{const files=await listDriveBackups();setDriveFiles(files);setMessage(files.length?`${files.length} Drive backups found.`:'No Body OS Drive backups yet.');})}><Text style={{color:'#F6F7F8'}}>Browse Drive backups</Text></Pressable>
    {driveFiles.map(file=><Pressable accessibilityRole="button" key={file.id} disabled={busy} style={{padding:14}} onPress={()=>void run(async()=>reviewText(await downloadDriveBackup(file)))}><Text style={{color:'#F6F7F8'}}>Review restore: {file.name}</Text></Pressable>)}
    {safetyUri&&<Pressable accessibilityRole="button" disabled={busy} style={{padding:14}} onPress={()=>void run(()=>share(new File(safetyUri),'application/json'))}><Text style={{color:'#F6F7F8'}}>Export pre-restore safety copy</Text></Pressable>}
    {message?<Text accessibilityLiveRegion="polite" style={{color:'#A7ADB7'}}>{message}</Text>:null}
  </View>;
}
