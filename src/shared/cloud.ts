import { z } from 'zod';
import { SYNC_ENTITY_TYPES, syncKey, type SyncRecord } from './sync.js';
import { measurementInputSchema, sessionInputSchema } from './schemas.js';
import { healthReadingSchema } from './health.js';

export interface CloudConfig { projectId: string; apiKey: string; }
export interface CloudSession { uid: string; idToken: string; }
export type CloudRecord = SyncRecord & { cloudVersion?: string; localPayload?: unknown };
export type SyncChoice = { side: 'local' | 'remote'; cloudVersion: string; localToken: string };
const envelope = z.object({
  id: z.string().min(1).max(200), entityType: z.enum(SYNC_ENTITY_TYPES),
  payload: z.record(z.string(), z.unknown()), updatedAt: z.string().min(1),
  revision: z.number().int().positive(), deviceId: z.string().min(1), deletedAt: z.string().optional(),
  workspace: z.string().min(1).max(80).optional(), payloadVersion: z.number().int().positive().optional(), createdAt: z.string().min(1).optional(),
  cloudVersion: z.string().optional(),
});
export function validateRecord(value: unknown): CloudRecord {
  const record = envelope.parse(value);
  if (!record.deletedAt) {
    if (record.entityType === 'session') sessionInputSchema.parse(record.payload);
    if (record.entityType === 'measurement') measurementInputSchema.parse(record.payload);
    if (record.entityType === 'healthReading') healthReadingSchema.parse(record.payload);
  }
  return record;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(k => (value as Record<string, unknown>)[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function sameContent(a?: SyncRecord, b?: SyncRecord): boolean {
  if (!a || !b) return a === b;
  return Boolean(a.deletedAt) === Boolean(b.deletedAt) && canonical(a.payload) === canonical(b.payload);
}
export function contentToken(record?: SyncRecord): string {
  return canonical(record ? { payload: record.payload, deleted: Boolean(record.deletedAt) } : null);
}
export function mergeDecision(local: SyncRecord | undefined, remote: CloudRecord | undefined, base?: SyncRecord): 'same' | 'upload' | 'download' | 'conflict' {
  if (sameContent(local, remote)) return 'same';
  if (!local) return 'download';
  if (!remote) return 'upload';
  if (base && sameContent(local, { ...base, payload: (base as CloudRecord).localPayload ?? base.payload }) && sameContent(remote, base)) return 'same';
  if (base && sameContent(local, { ...base, payload: (base as CloudRecord).localPayload ?? base.payload })) return 'download';
  if (base && sameContent(remote, base)) return 'upload';
  return 'conflict';
}
export class CloudConflictError extends Error { constructor() { super('Cloud data changed during sync. Retry to review the latest conflict.'); this.name = 'CloudConflictError'; } }
function root(config: CloudConfig, session: CloudSession) {
  if (!/^[a-z][a-z0-9-]{3,62}$/.test(config.projectId)) throw new Error('Invalid Firebase project ID.');
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/users/${encodeURIComponent(session.uid)}/records`;
}
function options(session: CloudSession): RequestInit {
  return { headers: { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000) };
}
type Fields = Record<string, { stringValue?: string; integerValue?: string }>;
export async function readCloud(config: CloudConfig, session: CloudSession): Promise<CloudRecord[]> {
  const records: CloudRecord[] = [];
  let page = '';
  const seen = new Set<string>();
  do {
    const response = await fetch(`${root(config, session)}?pageSize=500${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, options(session));
    if (!response.ok) throw new Error(`Cloud read failed (${response.status}). Sign in again if your session expired.`);
    const result = await response.json() as { documents?: { fields: Fields; updateTime: string }[]; nextPageToken?: string };
    for (const doc of result.documents || []) {
      const f = doc.fields;
      records.push(validateRecord({ id: f.id?.stringValue, entityType: f.entityType?.stringValue,
        payload: JSON.parse(f.payloadJson?.stringValue || '{}'), updatedAt: f.updatedAt?.stringValue,
        revision: Number(f.revision?.integerValue), deviceId: f.deviceId?.stringValue,
        deletedAt: f.deletedAt?.stringValue, workspace:f.workspace?.stringValue, payloadVersion:f.payloadVersion?.integerValue?Number(f.payloadVersion.integerValue):undefined,
        createdAt:f.createdAt?.stringValue, cloudVersion: doc.updateTime }));
    }
    page = result.nextPageToken || '';
    if (page && seen.has(page)) throw new Error('Cloud returned a repeated page token. Sync stopped without writing.');
    seen.add(page);
  } while (page);
  return records;
}
export async function writeCloud(config: CloudConfig, session: CloudSession, input: SyncRecord, previous?: CloudRecord): Promise<CloudRecord> {
  const record = validateRecord(input);
  if (previous && !previous.cloudVersion) throw new Error('Missing cloud version; refresh before saving.');
  const condition = previous ? `currentDocument.updateTime=${encodeURIComponent(previous.cloudVersion!)}` : 'currentDocument.exists=false';
  const fields: Fields = {
    id: { stringValue: record.id }, entityType: { stringValue: record.entityType }, payloadJson: { stringValue: JSON.stringify(record.payload) },
    updatedAt: { stringValue: record.updatedAt }, revision: { integerValue: String(record.revision) }, deviceId: { stringValue: record.deviceId },
    ...(record.deletedAt ? { deletedAt: { stringValue: record.deletedAt } } : {}),
    ...(record.workspace ? { workspace: { stringValue: record.workspace } } : {}),
    ...(record.payloadVersion ? { payloadVersion: { integerValue: String(record.payloadVersion) } } : {}),
    ...(record.createdAt ? { createdAt: { stringValue: record.createdAt } } : {}),
  };
  const response = await fetch(`${root(config, session)}/${encodeURIComponent(syncKey(record))}?${condition}`, { ...options(session), method: 'PATCH', body: JSON.stringify({ fields }) });
  if ([409, 412].includes(response.status)) throw new CloudConflictError();
  if (!response.ok) throw new Error(`Cloud save failed (${response.status}). Local changes remain pending.`);
  const result = await response.json() as { updateTime: string };
  return { ...record, cloudVersion: result.updateTime };
}
