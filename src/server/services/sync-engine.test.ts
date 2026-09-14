import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { syncKey, syncRecordsFromDb } from '../../shared/sync.js';
import { contentToken, type CloudRecord } from '../../shared/cloud.js';

test('desktop sync downloads, reviews conflicts, and propagates deletion without duplicate writes',async()=>{
  assert.ok(process.env.BODY_OS_DATA_DIR?.includes('scratch'));
  process.env.BODY_OS_DATA_DIR=path.join(process.env.BODY_OS_DATA_DIR!,'sync-test');
  const {getDb,closeDb}=await import('../db/connection.js');
  const {migrate}=await import('../db/migrate.js');
  const repo=await import('../db/repository.js');
  const {runDesktopSync}=await import('./sync-engine.js');
  migrate(getDb());
  repo.saveMeasurement({id:'sync-weight',date:'2026-09-07',weight:80,createdAt:'2026-09-07'});
  const remote=new Map<string,CloudRecord>(syncRecordsFromDb(repo.loadAppDb(),'desktop').map(r=>[syncKey(r),{...r,cloudVersion:'2026-09-07T00:00:00Z'}]));
  const key='measurement:sync-weight';let writes=0;
  const old=globalThis.fetch;
  globalThis.fetch=async(input,options)=>{
    if(options?.method==='PATCH') {
      writes++;
      const fields=JSON.parse(String(options.body)).fields;
      const r:CloudRecord={id:fields.id.stringValue,entityType:fields.entityType.stringValue,payload:JSON.parse(fields.payloadJson.stringValue),revision:Number(fields.revision.integerValue),updatedAt:fields.updatedAt.stringValue,deviceId:fields.deviceId.stringValue,deletedAt:fields.deletedAt?.stringValue,cloudVersion:'2026-09-07T01:00:00Z'};
      remote.set(syncKey(r),r);
      return new Response(JSON.stringify({updateTime:r.cloudVersion}));
    }
    return new Response(JSON.stringify({documents:[...remote.values()].map(r=>({updateTime:r.cloudVersion,fields:{id:{stringValue:r.id},entityType:{stringValue:r.entityType},payloadJson:{stringValue:JSON.stringify(r.payload)},revision:{integerValue:String(r.revision)},updatedAt:{stringValue:r.updatedAt},deviceId:{stringValue:r.deviceId},...(r.deletedAt?{deletedAt:{stringValue:r.deletedAt}}:{})}}))}));
  };
  try {
    const config={projectId:'body-os-test',apiKey:''},session={uid:'test',idToken:'test'};
    await runDesktopSync(config,session,'desktop');assert.equal(writes,0);
    remote.set(key,{...remote.get(key)!,payload:{...remote.get(key)!.payload as object,weight:81},revision:2});
    const download=await runDesktopSync(config,session,'desktop');assert.equal(download.downloaded,1);
    assert.equal(repo.listMeasurements().find(m=>m.id==='sync-weight')?.weight,81);
    repo.saveMeasurement({...repo.listMeasurements().find(m=>m.id==='sync-weight')!,weight:82});
    remote.set(key,{...remote.get(key)!,payload:{...remote.get(key)!.payload as object,weight:83},revision:3});
    const conflict=await runDesktopSync(config,session,'desktop');assert.equal(conflict.conflicts.length,1);
    const invalidChoice=await runDesktopSync(config,session,'desktop',{[key]:{side:'' as 'local',cloudVersion:remote.get(key)!.cloudVersion!,localToken:contentToken(conflict.conflicts[0].local)}});
    assert.equal(invalidChoice.conflicts.length,1);
    assert.equal(repo.listMeasurements().find(m=>m.id==='sync-weight')?.weight,82);
    await runDesktopSync(config,session,'desktop',{[key]:{side:'local',cloudVersion:remote.get(key)!.cloudVersion!,localToken:contentToken(conflict.conflicts[0].local)}});
    assert.equal((remote.get(key)!.payload as {weight:number}).weight,82);
    repo.deleteMeasurement('sync-weight');await runDesktopSync(config,session,'desktop');
    assert.ok(remote.get(key)!.deletedAt);
    const before=writes;await runDesktopSync(config,session,'desktop');assert.equal(writes,before);
    const split=repo.listLibrarySplits()[0];const splitKey=`librarySplit:${split.id}`;remote.set(splitKey,{...remote.get(splitKey)!,payload:{...split,notes:'Edited on phone'},revision:2});await runDesktopSync(config,session,'desktop');assert.equal(repo.listLibrarySplits().find(s=>s.id===split.id)?.notes,'Edited on phone');
    await assert.rejects(runDesktopSync(config,{uid:'another-user',idToken:'another-token'},'desktop'),/another cloud account/);
    assert.equal(writes,before);
  } finally {globalThis.fetch=old;closeDb();}
});
