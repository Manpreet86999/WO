import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { bodyOsGoogleWebClientId } from '../../../../src/shared/firebase-config';
export interface DriveBackup {id:string;name:string;createdTime:string;size?:string;}
async function authorization() {
  GoogleSignin.configure({webClientId:bodyOsGoogleWebClientId});
  if(!GoogleSignin.hasPreviousSignIn())throw new Error('Use Continue with Google first, then connect Drive.');
  const result=await GoogleSignin.addScopes({scopes:['https://www.googleapis.com/auth/drive.appdata']});
  if(!result||!isSuccessResponse(result))throw new Error('Drive permission was not granted.');
  const {accessToken}=await GoogleSignin.getTokens();return {Authorization:`Bearer ${accessToken}`};
}
async function checked(response:Response){if(!response.ok)throw new Error(`Drive request failed (${response.status}). Check Drive API access and your Google permissions.`);return response;}
export async function uploadDriveBackup(text:string):Promise<DriveBackup> {
  const headers=await authorization();
  const metadata={name:`body-os-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,parents:['appDataFolder'],mimeType:'application/json'};
  const started=await checked(await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,createdTime,size',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Upload-Content-Type':'application/json'},body:JSON.stringify(metadata),signal:AbortSignal.timeout(30000)}));
  const location=started.headers.get('Location');if(!location||new URL(location).origin!=='https://www.googleapis.com')throw new Error('Drive returned an invalid upload location.');
  const response=await checked(await fetch(location,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:text,signal:AbortSignal.timeout(60000)}));return response.json();

}
export async function listDriveBackups():Promise<DriveBackup[]> {
  const headers=await authorization(),files:DriveBackup[]=[];let token='';
  do{const response=await checked(await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=100&orderBy=createdTime%20desc&fields=nextPageToken,files(id,name,createdTime,size)${token?`&pageToken=${encodeURIComponent(token)}`:''}`,{headers,signal:AbortSignal.timeout(30000)}));const data=await response.json() as {files?:DriveBackup[];nextPageToken?:string};files.push(...(data.files||[]).filter(f=>f.name.startsWith('body-os-backup-')));token=data.nextPageToken||'';}while(token);
  return files;
}
export async function downloadDriveBackup(file:DriveBackup):Promise<string> {
  if(Number(file.size||0)>25*1024*1024)throw new Error('Backup exceeds the 25 MB import limit.');
  const response=await checked(await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,{headers:await authorization(),signal:AbortSignal.timeout(60000)}));return response.text();
}
