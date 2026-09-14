import { canonical } from '../../shared/cloud';
import { useCloudAccount, resolveConflictChoice } from '../state/CloudAccountContext';

const labels = {
  loading: 'Checking your Google account…', 'signed-out': 'Google sign-in is required to open the normal Body OS workspace.', saved: 'Saved', syncing: 'Syncing',
  offline: 'Offline — records will sync when you reconnect.', pending: 'Sync pending', 'needs-review': 'Needs review', error: 'Sync pending — local records are still safe on this device.',
} as const;

export function CloudSyncPanel() {
  const cloud = useCloudAccount();
  const conflicts = cloud.result?.conflicts || [];
  const completeChoices = conflicts.length > 0 && conflicts.every((conflict) => Boolean(cloud.choices[conflict.key]));
  return <section className="glass card stack" aria-label="Device sync">
    <div className="row justify-between" style={{ alignItems: 'center' }}><h3 style={{ margin: 0 }}>Device sync</h3><span className={`chip ${cloud.status === 'saved' ? 'ready-ok' : ''}`}>{labels[cloud.status]}</span></div>
    <p className="subtle">Body OS uses your Google account for this workspace. Your records remain usable on this device while offline.</p>
    {cloud.migrationRequired && <div className="box"><strong>First sync review</strong><p className="subtle">{cloud.migrationPreview ? `${cloud.migrationPreview.localRecords} local records and ${cloud.migrationPreview.remoteRecords} cloud records will be compared. ${cloud.migrationPreview.conflicts} conflict(s) need a choice before anything is overwritten.` : 'Preparing your local and cloud record counts…'}</p><button type="button" className="btn btn-primary" disabled={!cloud.migrationPreview} onClick={() => void cloud.approveMigration()}>Review & start secure sync</button></div>}
    {!cloud.user ? <button type="button" className="btn btn-hot" disabled={cloud.status === 'loading'} onClick={() => void cloud.signIn()}>Continue with Google</button> : <>
      <p className="subtle" style={{ margin: 0 }}>Connected as {cloud.user.email || 'Google account'}</p><div className="row"><button type="button" className="btn btn-primary" disabled={cloud.status === 'syncing' || (conflicts.length > 0 && !completeChoices)} onClick={() => void cloud.syncNow()}>{cloud.status === 'syncing' ? 'Syncing…' : conflicts.length > 0 ? 'Apply choices & sync' : 'Sync now'}</button><button type="button" className="btn btn-soft" disabled={cloud.status === 'syncing'} onClick={() => void cloud.signOut()}>Sign out</button></div>
    </>}
    <div role="status" className="subtle">{cloud.error || (cloud.result ? `${cloud.result.uploaded} uploaded · ${cloud.result.downloaded} downloaded · ${conflicts.length} need review` : labels[cloud.status])}</div>
    {conflicts.map((conflict) => {
      const local = conflict.local.payload as Record<string, unknown>, remote = conflict.remote.payload as Record<string, unknown>;
      const changed = Array.from(new Set([...Object.keys(local), ...Object.keys(remote)])).filter((key) => canonical(local[key]) !== canonical(remote[key]));
      return <details key={conflict.key}><summary>Review {String(local.name || local.date || conflict.key)}</summary><p className="subtle">{changed.join(', ') || 'Record state changed'} · choose the version to keep.</p><select className="input" aria-label={`Resolve ${conflict.key}`} value={cloud.choices[conflict.key]?.side || ''} onChange={(event) => cloud.choose(conflict.key, event.target.value ? resolveConflictChoice(conflict, event.target.value as 'local' | 'remote') : null)}><option value="">Choose a version</option><option value="local">Keep this web version</option><option value="remote">Keep cloud version</option></select></details>;
    })}
    {conflicts.length > 0 && <p className="subtle">Choose every conflict before syncing. Body OS never overwrites a conflict silently.</p>}
  </section>;
}
