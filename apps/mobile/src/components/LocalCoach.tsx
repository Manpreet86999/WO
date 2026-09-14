import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { localCoach } from '../../../../src/shared/local-coach';
import { localSkinAdvice } from '../../../../src/shared/skin';
import { localDateKey } from '../../../../src/shared/evidence';
import { snapshotFromRecords } from '../../../../src/shared/record-snapshot';
import type { SyncRecord } from '../../../../src/shared/sync';
export function LocalCoach({records,skin=false}:{records:SyncRecord[];skin?:boolean}) {
  const advice=useMemo(()=>{const db=snapshotFromRecords(records);return skin?localSkinAdvice(db.skin!,localDateKey()):localCoach(db).advice;},[records,skin]);
  return <View style={{padding:16,gap:10,backgroundColor:'#17191F',borderRadius:18}}><Text style={{color:'#9EEA22',fontSize:20}}>{skin?'Skincare':'Training'} guidance</Text><Text style={{color:'#A7ADB7'}}>Offline guidance from your records, using the same rules as web.</Text>{advice.map((line,i)=><Text key={i} style={{color:'#F6F7F8',lineHeight:24}}>{line}</Text>)}</View>;
}
