import * as repo from '../db/repository.js';
import { getDb, withTransaction } from '../db/connection.js';
import { syncKey, syncRecordsFromDb, type SyncRecord } from '../../shared/sync.js';
import { contentToken, type SyncChoice, mergeDecision, readCloud, sameContent, validateRecord, writeCloud, type CloudConfig, type CloudRecord, type CloudSession } from '../../shared/cloud.js';
import { healthReadingSchema } from '../../shared/health.js';
import { logFailure, logger } from '../lib/logger.js';

function tables() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS cloud_bases (account TEXT NOT NULL, key TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(account,key));
    CREATE TABLE IF NOT EXISTS cloud_identity (id INTEGER PRIMARY KEY CHECK(id=1), account TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS health_readings (id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
}
function bases(account: string): Map<string, CloudRecord> {
  tables();
  const rows = getDb().prepare('SELECT key,data FROM cloud_bases WHERE account=?').all(account) as {key:string;data:string}[];
  return new Map(rows.map(r => [r.key, JSON.parse(r.data)]));
}
function saveBase(account: string, record: CloudRecord) {
  getDb().prepare('INSERT INTO cloud_bases(account,key,data) VALUES(?,?,?) ON CONFLICT(account,key) DO UPDATE SET data=excluded.data').run(account, syncKey(record), JSON.stringify(record));
}
export function localSnapshot(base: Map<string, CloudRecord>, deviceId: string): Map<string, SyncRecord> {
  const current = new Map(syncRecordsFromDb(repo.loadAppDb(), deviceId).map(r => [syncKey(r), r]));
  for (const [key, previous] of base) if (!current.has(key)) current.set(key, { ...previous, deletedAt: previous.deletedAt || new Date().toISOString(), deviceId });
  return current;
}
const tablesByType: Partial<Record<SyncRecord['entityType'], string>> = {
  session:'sessions', week:'weeks', librarySplit:'library_splits', readiness:'readiness', target:'targets', measurement:'measurements', habit:'habits', habitLog:'habit_logs',
  cardio:'cardio_sessions', goalCheckIn:'goal_check_ins', weeklyReview:'weekly_reviews', exercise:'exercise_library', program:'programs', painLog:'pain_logs', scheduledWorkout:'scheduled_workouts',
  skinProduct:'skin_products', skinRoutine:'skin_routines', skinLog:'skin_logs', healthReading:'health_readings',
};
function applyRecord(raw: CloudRecord) {
  const record = validateRecord(raw);
  if (record.deletedAt) {
    const table = tablesByType[record.entityType];
    if (!table) throw new Error('A profile or settings record cannot be deleted through sync.');
    if (record.entityType === 'session') getDb().prepare('DELETE FROM session_sets WHERE session_id=?').run(record.id);
    getDb().prepare(`DELETE FROM ${table} WHERE id=?`).run(record.id);
    return;
  }
  const value = { ...(record.payload as object), id: record.id };
  const writers = {
    week: repo.upsertWeek, librarySplit: repo.saveLibrarySplit, session: repo.saveSession, readiness: repo.saveReadiness, target: repo.saveTarget,
    measurement: repo.saveMeasurement, habit: repo.saveHabit, habitLog: repo.saveHabitLog, cardio: repo.saveCardioSession,
    goalCheckIn: repo.saveGoalCheckIn, weeklyReview: repo.saveWeeklyReview, exercise: repo.saveExercise,
    program: repo.saveProgram, painLog: repo.savePainLog, scheduledWorkout: repo.saveScheduledWorkout,
    profile: repo.saveProfile, trainingConfig: repo.saveTrainingConfig, skinProfile: repo.saveSkinProfile,
    skinProduct: repo.saveSkinProduct, skinRoutine: repo.saveSkinRoutine, skinLog: repo.saveSkinLog,
  };
  if (record.entityType === 'workspaceState') {
    const active=(value as {activeWeekId?:unknown}).activeWeekId;
    if(typeof active!=='string')throw new Error('Invalid active plan setting.');
    repo.setActiveWeekId(active);
  } else if (record.entityType === 'healthReading') {
    const reading = healthReadingSchema.parse(value);
    getDb().prepare('INSERT INTO health_readings(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(record.id, JSON.stringify(reading));
  } else writers[record.entityType](value as never);
}
let running = false;
export async function runDesktopSync(config: CloudConfig, session: CloudSession, deviceId: string, choices: Record<string, SyncChoice> = {}) {
  if (running) throw new Error('Sync is already running.');
  running = true;
  try {
    const account = `${config.projectId}/${session.uid}`;
    const base = bases(account);
    const identity=getDb().prepare('SELECT account FROM cloud_identity WHERE id=1').get() as {account:string}|undefined;
    const previousAccounts=getDb().prepare('SELECT DISTINCT account FROM cloud_bases').all() as {account:string}[];
    if((identity&&identity.account!==account)||previousAccounts.some(row=>row.account!==account))throw new Error('These local records belong to another cloud account. Use the original account to avoid mixing data.');
    const remote = new Map((await readCloud(config, session)).map(r => [syncKey(r), r]));
    getDb().prepare('INSERT OR IGNORE INTO cloud_identity(id,account) VALUES(1,?)').run(account);
    const local = localSnapshot(base, deviceId);
    const conflicts: {key:string;local:SyncRecord;remote:CloudRecord}[] = [];
    let uploaded = 0, downloaded = 0;
    for (const key of new Set([...local.keys(), ...remote.keys()])) {
      const l = local.get(key), r = remote.get(key);
      let decision = mergeDecision(l, r, base.get(key));
      const choice = choices[key];
      if (decision === 'conflict' && choice && (choice.side === 'local' || choice.side === 'remote') && choice.cloudVersion === r?.cloudVersion && choice.localToken === contentToken(l)) decision = choice.side === 'local' ? 'upload' : 'download';
      if (decision === 'conflict') { conflicts.push({ key, local: l!, remote: r! }); continue; }
      if (decision === 'same') { if (r) saveBase(account,{...r,localPayload:l?.payload}); continue; }
      if (decision === 'download' && r) {
        // A local edit during an earlier network write must not be overwritten.
        const current = localSnapshot(base, deviceId).get(key);
        if (!sameContent(current,l)) { conflicts.push({key, local:current!,remote:r}); continue; }
        withTransaction(() => {
          applyRecord(r);
          // Repository normalization may add fields. Store the actual local shape as the merge base.
          const saved = localSnapshot(new Map([[key,r]]),deviceId).get(key) || r;
          saveBase(account, { ...r, localPayload: saved.payload });
        });
        downloaded++;
      }
      if (decision === 'upload' && l) {
        const saved = await writeCloud(config,session,{...l, revision:Math.max(l.revision,r?.revision || 0)+1, updatedAt:new Date().toISOString(),deviceId},r);
        saveBase(account,saved);
        uploaded++;
      }
    }
    logger.info({event:'sync.completed',uploaded,downloaded,conflicts:conflicts.length}, 'Sync completed');
    return {uploaded,downloaded,conflicts};
  } catch(error) { logFailure('sync.failed',error); throw error; }
  finally { running = false; }
}
