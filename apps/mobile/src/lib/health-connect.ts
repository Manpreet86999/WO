import type { RecordResult } from 'react-native-health-connect';
import { Platform } from 'react-native';
import { healthReadingSchema, type HealthReading } from '../../../../src/shared/health';
import { localDateKey } from '../../../../src/shared/evidence';
import { deviceId, listRecords, saveRecord } from './store';
import { canonical } from '../../../../src/shared/cloud';

export async function importHealthReadings() {
  if (Platform.OS !== 'android') throw new Error('Health Connect is available in the Android build.');
  // Lazy loading keeps the rest of the app usable in Expo Go and unsupported builds.
  const health = await import('react-native-health-connect');
  if (!await health.initialize()) throw new Error('Health Connect is unavailable. Install or update it in Android settings.');
  const kinds = ['Steps','SleepSession','RestingHeartRate'] as const;
  const grants = await health.requestPermission(kinds.map(recordType => ({accessType:'read' as const,recordType})));
  const allowed = kinds.filter(kind => grants.some(g => g.accessType === 'read' && g.recordType === kind));
  if (!allowed.length) throw new Error('No health permissions granted. Your manual records remain available.');
  const end = new Date(), start = new Date();start.setDate(start.getDate()-7);start.setHours(0,0,0,0);
  const [device,existing] = await Promise.all([deviceId(),listRecords()]);
  const byId = new Map(existing.filter(r=>r.entityType==='healthReading').map(r=>[r.id,r]));
  let imported=0,unchanged=0,skipped=0;
  for(const kind of allowed) {
    const sourceIds = new Set<string>();
    let complete = true;
    let pageToken: string | undefined;
    const seen=new Set<string>();
    do {
      const result=await health.readRecords(kind,{timeRangeFilter:{operator:'between',startTime:start.toISOString(),endTime:end.toISOString()},pageSize:500,pageToken});
      for(const record of result.records as (RecordResult<'Steps'> | RecordResult<'SleepSession'> | RecordResult<'RestingHeartRate'>)[]) {
        if(!record.metadata?.id || !record.metadata.dataOrigin) {skipped++;complete=false;continue;}
        const startTime='time' in record ? record.time : record.startTime;
        const endTime='time' in record ? record.time : record.endTime;
        // Sleep is recorded session duration, not a claim about actual time asleep.
        const value='count' in record ? record.count : 'beatsPerMinute' in record ? record.beatsPerMinute : (Date.parse(endTime)-Date.parse(startTime))/3600000;
        const id=`hc-${kind}-${record.metadata.id}`;
        sourceIds.add(id);
        const reading=healthReadingSchema.parse({id,kind,value,unit:kind==='Steps'?'steps':kind==='SleepSession'?'hours':'bpm',
          date:localDateKey(new Date(kind==='SleepSession'?endTime:startTime)),startTime,endTime,source:record.metadata.dataOrigin,sourceRecordId:record.metadata.id,importedAt:new Date().toISOString()});
        const old=byId.get(id);
        if(old && !old.deletedAt && canonical({...old.payload as HealthReading,importedAt:''})===canonical({...reading,importedAt:''})) {unchanged++;continue;}
        await saveRecord({id,entityType:'healthReading',payload:reading,revision:(old?.revision || 0)+1,deviceId:device,updatedAt:reading.importedAt});
        imported++;
      }
      pageToken=result.pageToken;
      if(pageToken && seen.has(pageToken)) throw new Error('Repeated health page token. Import stopped; saved readings are retained.');
      if(pageToken) seen.add(pageToken);
    } while(pageToken);
    // Reconcile only fully covered intervals of a successfully read, permitted type.
    for (const old of byId.values()) {
      const reading = old.payload as HealthReading;
      if (complete && !old.deletedAt && reading.kind === kind && Date.parse(reading.startTime) >= start.getTime() && Date.parse(reading.endTime) <= end.getTime() && !sourceIds.has(old.id)) {
        await saveRecord({...old,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),deviceId:device});
      }
    }
  }
  return {imported,unchanged,skipped,denied:kinds.filter(kind=>!allowed.includes(kind))};
}
