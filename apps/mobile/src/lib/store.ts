import type * as SQLite from 'expo-sqlite';
import { syncKey, type SyncRecord } from '../../../../src/shared/sync';
import { sameContent, validateRecord, type CloudRecord } from '../../../../src/shared/cloud';

let connection: Promise<SQLite.SQLiteDatabase> | undefined;
let databaseFactory=async()=>{const SQLite=await import('expo-sqlite');return SQLite.openDatabaseAsync('body-os-mobile.db');};
/** Inject an equivalent SQLite connection before first use (storage integration tests). */
export function configureDatabaseFactory(factory:()=>Promise<SQLite.SQLiteDatabase>){if(connection)throw new Error('Database is already open.');databaseFactory=factory;}
const listeners=new Set<()=>void>();
const preferenceListeners=new Set<(key:string)=>void>();
export function subscribePreferences(listener:(key:string)=>void){preferenceListeners.add(listener);return()=>{preferenceListeners.delete(listener);};}
export function subscribeLocalChanges(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function changed(){for(const listener of listeners)listener();}
export function db() {
  return connection ??= (async () => {
    const conn = await databaseFactory();
    await conn.execAsync(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sync_records(key TEXT PRIMARY KEY,entity_type TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL,revision INTEGER NOT NULL,device_id TEXT NOT NULL,deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS sync_outbox(key TEXT PRIMARY KEY,queued_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_conflicts(key TEXT PRIMARY KEY,local_payload TEXT NOT NULL,remote_payload TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_bases(key TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    return conn;
  })().catch(error => {connection=undefined;throw error;});
}
export const keyOf = syncKey;
type Row = {key:string;entity_type:SyncRecord['entityType'];id:string;payload:string;updated_at:string;revision:number;device_id:string;deleted_at:string|null};
function unpack(r:Row):SyncRecord {return {id:r.id,entityType:r.entity_type,payload:JSON.parse(r.payload),updatedAt:r.updated_at,revision:r.revision,deviceId:r.device_id,deletedAt:r.deleted_at || undefined};}
export async function listRecords():Promise<SyncRecord[]> {return (await (await db()).getAllAsync<Row>('SELECT * FROM sync_records')).map(unpack);}
async function write(conn:Pick<SQLite.SQLiteDatabase,'runAsync'>,record:SyncRecord) {
  await conn.runAsync(`INSERT INTO sync_records(key,entity_type,id,payload,updated_at,revision,device_id,deleted_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,revision=excluded.revision,device_id=excluded.device_id,deleted_at=excluded.deleted_at`,
    syncKey(record),record.entityType,record.id,JSON.stringify(record.payload),record.updatedAt,record.revision,record.deviceId,record.deletedAt || null);
}
export async function preference<T>(key:string,fallback:T):Promise<T> {
  const row = await (await db()).getFirstAsync<{value:string}>('SELECT value FROM preferences WHERE key=?',key);
  return row ? JSON.parse(row.value) : fallback;
}
export async function setPreference(key:string,value:unknown) {await (await db()).runAsync('INSERT INTO preferences(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value));for(const listener of preferenceListeners)listener(key);}
export async function deviceId() {
  let value = await preference('deviceId','');
  if (!value) { value=`android-${Date.now()}-${Math.random().toString(36).slice(2)}`;await setPreference('deviceId',value); }
  return value;
}
export async function saveRecord(input:SyncRecord,queue=true,expectedRevision?:number) {
  const record=validateRecord(input),conn=await db();
  await conn.withExclusiveTransactionAsync(async tx => {
    const old=await tx.getFirstAsync<Row>('SELECT * FROM sync_records WHERE key=?',syncKey(record));
    if(queue&&expectedRevision!==undefined&&(old?.revision||0)!==expectedRevision)throw new Error('This record changed while you were editing. Cancel and reopen it to review the latest version.');
    const next=queue ? {...record,revision:Math.max(record.revision,(old?.revision || 0)+1)} : record;
    await write(tx,next);
    if (queue) await tx.runAsync('INSERT INTO sync_outbox(key,queued_at) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET queued_at=excluded.queued_at',syncKey(record),new Date().toISOString());
    if(queue&&record.entityType==='goalCheckIn'&&!record.deletedAt) {
      const goalId=(record.payload as {goalId?:string}).goalId;
      const goalRow=goalId?await tx.getFirstAsync<Row>('SELECT * FROM sync_records WHERE key=?',`target:${goalId}`):null;
      if(goalRow&&!goalRow.deleted_at){
        const goal=unpack(goalRow),payload=goal.payload as Record<string,unknown>;
        const entries=(await tx.getAllAsync<Row>("SELECT * FROM sync_records WHERE entity_type='goalCheckIn' AND deleted_at IS NULL")).map(r=>unpack(r).payload as {id:string;goalId:string;date:string;createdAt:string;value:number});
        const latest=entries.filter(c=>c.goalId===goalId).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt))||String(b.id).localeCompare(String(a.id)))[0];
        if(latest&&Number.isFinite(Number(latest.value))){
          const lower=String(payload.type).includes('loss')||payload.type==='body-fat',value=Number(latest.value),target=Number(payload.target);
          const reached=target>0&&(lower?value>0&&value<=target:value>=target),now=new Date().toISOString();
          await write(tx,{...goal,payload:{...payload,current:value,status:reached?'completed':'active'},revision:goal.revision+1,updatedAt:now,deviceId:record.deviceId});
          await tx.runAsync('INSERT INTO sync_outbox(key,queued_at) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET queued_at=excluded.queued_at',syncKey(goal),now);
        }
      }
    }
  });
  if(queue)changed();
}
export async function pendingKeys() {return new Set((await (await db()).getAllAsync<{key:string}>('SELECT key FROM sync_outbox')).map(r=>r.key));}
export async function listBases():Promise<Map<string,CloudRecord>> {return new Map((await (await db()).getAllAsync<{key:string;data:string}>('SELECT * FROM sync_bases')).map(r=>[r.key,JSON.parse(r.data)]));}
export async function acceptRemote(remote:CloudRecord,expected?:SyncRecord) {
  const conn=await db();
  await conn.withExclusiveTransactionAsync(async tx => {
    const row=await tx.getFirstAsync<Row>('SELECT * FROM sync_records WHERE key=?',syncKey(remote));
    if (!sameContent(row ? unpack(row) : undefined,expected)) throw new Error('This record changed locally during sync. Retry to review it.');
    await write(tx,remote);
    await tx.runAsync('INSERT INTO sync_bases(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data',syncKey(remote),JSON.stringify(remote));
    await tx.runAsync('DELETE FROM sync_outbox WHERE key=?',syncKey(remote));
    await tx.runAsync('DELETE FROM sync_conflicts WHERE key=?',syncKey(remote));
  });
}
export async function acknowledge(remote:CloudRecord,sent:SyncRecord) {
  const conn=await db();
  await conn.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync('INSERT INTO sync_bases(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data',syncKey(remote),JSON.stringify(remote));
    const row=await tx.getFirstAsync<Row>('SELECT * FROM sync_records WHERE key=?',syncKey(sent));
    if(row && sameContent(unpack(row),sent) && row.revision===sent.revision) {
      await write(tx,remote);
      await tx.runAsync('DELETE FROM sync_outbox WHERE key=?',syncKey(sent));
      await tx.runAsync('DELETE FROM sync_conflicts WHERE key=?',syncKey(sent));
    }
  });
}
export async function saveConflict(local:SyncRecord,remote:CloudRecord) {
  await (await db()).runAsync('INSERT INTO sync_conflicts(key,local_payload,remote_payload,created_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET local_payload=excluded.local_payload,remote_payload=excluded.remote_payload,created_at=excluded.created_at',syncKey(local),JSON.stringify(local),JSON.stringify(remote),new Date().toISOString());
}
export async function listConflicts() {return (await (await db()).getAllAsync<{key:string;local_payload:string;remote_payload:string}>('SELECT * FROM sync_conflicts')).map(r=>({key:r.key,local:JSON.parse(r.local_payload) as SyncRecord,remote:JSON.parse(r.remote_payload) as CloudRecord}));}

/** Merge a reviewed backup atomically; tombstones and new revisions remain syncable. */
export async function saveRecordsAtomically(inputs:SyncRecord[],account?:string) {
  const records=inputs.map(validateRecord),conn=await db(),device=await deviceId();
  await conn.withExclusiveTransactionAsync(async tx=>{
    const row=await tx.getFirstAsync<{value:string}>('SELECT value FROM preferences WHERE key=?','syncAccount');
    const bound=row?JSON.parse(row.value) as string:'';
    if(account&&bound&&account!==bound)throw new Error('This backup belongs to another cloud account.');
    if(account&&!bound)await tx.runAsync('INSERT INTO preferences(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','syncAccount',JSON.stringify(account));
    for(const input of records){
      const old=await tx.getFirstAsync<Row>('SELECT * FROM sync_records WHERE key=?',syncKey(input));
      const now=new Date().toISOString();await write(tx,{...input,deviceId:device,updatedAt:now,revision:Math.max(input.revision,(old?.revision||0)+1)});
      await tx.runAsync('INSERT INTO sync_outbox(key,queued_at) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET queued_at=excluded.queued_at',syncKey(input),now);
      await tx.runAsync('DELETE FROM sync_conflicts WHERE key=?',syncKey(input));
    }
  });
  changed();
}

export const restoreRecords = saveRecordsAtomically;
