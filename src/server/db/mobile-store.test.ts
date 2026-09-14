import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { SyncRecord } from '../../shared/sync.js';

test('mobile SQLite transactions preserve concurrent edits, outbox, identity, and atomic restore',async()=>{
  const sql=new DatabaseSync(':memory:');
  const adapter={
    execAsync:async(query:string)=>{sql.exec(query);},
    runAsync:async(query:string,...params:any[])=>sql.prepare(query).run(...params),
    getFirstAsync:async(query:string,...params:any[])=>sql.prepare(query).get(...params)||null,
    getAllAsync:async(query:string,...params:any[])=>sql.prepare(query).all(...params),
    withExclusiveTransactionAsync:async(action:(tx:any)=>Promise<void>)=>{sql.exec('BEGIN IMMEDIATE');try{await action(adapter);sql.exec('COMMIT');}catch(error){sql.exec('ROLLBACK');throw error;}},
  };
  const mobileStorePath='../../../apps/mobile/src/lib/store.ts';
  const store=await import(mobileStorePath);
  store.configureDatabaseFactory(async()=>adapter as any);
  const row:SyncRecord={id:'goal',entityType:'target',payload:{id:'goal',name:'Strength',type:'strength',current:0,target:100,status:'active'},revision:1,updatedAt:'2026-09-09',deviceId:'test'};
  try {
    await store.saveRecord(row,true,0);
    assert.equal((await store.pendingKeys()).has('target:goal'),true);
    const original=(await store.listRecords())[0];
    await store.saveRecord({...original,payload:{...original.payload as object,current:10}},true,original.revision);
    await assert.rejects(store.saveRecord(original,true,original.revision),/changed while you were editing/);
    const newest=(await store.listRecords())[0];
    await store.acknowledge({...original,cloudVersion:'old-version'},original);
    assert.equal((await store.pendingKeys()).has('target:goal'),true);
    await assert.rejects(store.acceptRemote({...original,cloudVersion:'remote'},original),/changed locally/);
    assert.equal((await store.listRecords())[0].revision,newest.revision);
    await store.setPreference('syncAccount','project/user');
    await assert.rejects(store.restoreRecords([row],'project/someone-else'),/another cloud account/);
    sql.exec("CREATE TRIGGER reject_bad BEFORE INSERT ON sync_records WHEN NEW.id='bad' BEGIN SELECT RAISE(ABORT,'simulated write failure'); END");
    await assert.rejects(store.restoreRecords([{...row,id:'first'},{...row,id:'bad'}]),/simulated write failure/);
    assert.equal((await store.listRecords()).some((r:SyncRecord)=>r.id==='first'),false);
    await store.saveRecord({id:'check',entityType:'goalCheckIn',payload:{id:'check',goalId:'goal',date:'2026-09-09',createdAt:'2026-09-09',value:50},updatedAt:'2026-09-09',revision:1,deviceId:'test'});
    assert.equal(((await store.listRecords()).find((r:SyncRecord)=>r.id==='goal')!.payload as {current:number}).current,50);
  }finally{sql.close();}
});
