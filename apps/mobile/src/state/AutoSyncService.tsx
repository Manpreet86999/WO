import {Platform} from 'react-native';
import {useAutoSync} from '../lib/use-auto-sync';
import {preference,setPreference} from '../lib/store';
import {savedSession,syncNow} from '../lib/firebase-sync';
import {bodyOsFirebaseConfig} from '../../../../src/shared/firebase-config';

/** Foreground-only worker. A first manual sync must precede unattended merges. */
export function AutoSyncService(){
  useAutoSync(Platform.OS!=='web',async()=>{
    if(!await preference('autoSync',false)||!await preference('lastSync',''))return;
    const session=await savedSession();
    if(!session)return;
    await syncNow(bodyOsFirebaseConfig,session,{},message=>{void setPreference('syncStatus',message);});
    await setPreference('syncStatus','Your records are up to date.');
  },message=>{void setPreference('syncStatus',message);});
  return null;
}
