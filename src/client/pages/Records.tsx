import { useMemo, useState } from 'react';

import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { useApp } from '../state/AppContext';
import { today } from '../lib/utils';
import type { Session } from '../lib/types';


export function Records() {
  const app = useApp();
  const toast = useToast();
  const { db, settings, setPage, analytics } = app;
  const [tab, setTab] = useState<'sessions' | 'cardio' | 'habits'>('sessions');
  const [weekId, setWeekId] = useState(db?.meta.activeWeekId || '');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Session>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const selected = weekId || db?.meta.activeWeekId || '';
  const prSessionIds = useMemo(() => {
    const set = new Set<string>();
    for (const pr of analytics?.recentPrs || []) {
      if (pr.sessionId) set.add(pr.sessionId);
    }
    for (const pr of analytics?.personalRecords || []) {
      if (pr.sessionId) set.add(pr.sessionId);
    }
    return set;
  }, [analytics?.recentPrs, analytics?.personalRecords]);

  const sessions = useMemo(() => {
    if (!db) return [];
    return db.sessions
      .filter((s) => s.weekId === selected && s.status === 'finished')
      .filter((s) => {
        if (dateFilter && s.date !== dateFilter) return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        if ((s.dayTitle || '').toLowerCase().includes(q)) return true;
        if ((s.name || '').toLowerCase().includes(q)) return true;
        if ((s.dayKey || '').toLowerCase().includes(q)) return true;
        return (s.logs || []).some((l) => (l.name || '').toLowerCase().includes(q));
      })
      .sort((a, b) => (a.dayKey || '').localeCompare(b.dayKey || ''));
  }, [db, selected, dateFilter, search]);

  if (!db || !settings) return null;

  async function sendReport(id: string) {
    if (!settings!.hasAppPassword || !settings!.recipients?.length) {
      toast.push('Configure email in Settings first', 'err');
      setPage('Settings');
      return;
    }
    try {
      const res = await app.api.sendReport(id);
      toast.push(`Report sent to ${res.sentTo.join(', ')}`, 'ok');
    } catch (e) {
      toast.push((e as Error).message, 'err');
    }
  }


  return (
    <div className="fade page-shell">
      <header className="page-hero">
        <div>
          <span className="page-eyebrow">History</span>
          <h2 className="page-title">Records</h2>
          <p className="page-sub">Review, edit, and email saved day records.</p>
        </div>
        <div className="page-hero-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <div className="page-tabs">
            <button type="button" className={`page-tab${tab === 'sessions' ? ' active' : ''}`} onClick={() => setTab('sessions')}>Sessions</button>
            <button type="button" className={`page-tab${tab === 'cardio' ? ' active' : ''}`} onClick={() => setTab('cardio')}>Cardio</button>
            <button type="button" className={`page-tab${tab === 'habits' ? ' active' : ''}`} onClick={() => setTab('habits')}>Habits</button>
          </div>
          {tab === 'sessions' && (
            <div className="row" style={{ flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
              <select className="input" style={{ maxWidth: 280 }} value={selected} onChange={(e) => setWeekId(e.target.value)}>
                {db.weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.weekNumber ? ` · Week ${w.weekNumber}` : ''}
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                placeholder="Search exercise / title"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <input
                className="input"
                type="date"
                style={{ maxWidth: 180 }}
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              {(search || dateFilter) && (
                <button type="button" className="btn btn-soft btn-sm" onClick={() => { setSearch(''); setDateFilter(''); }}>
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {tab === 'sessions' && (
      <section className="page-panel">
        <div className="page-panel-head">
          <div>
            <span className="page-section-label">Import</span>
            <h3>Import Records</h3>
          </div>
        </div>
        <p className="subtle mb-3">Choose a Body OS backup JSON or a sessions array. Duplicates are skipped.</p>
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const res = await app.api.importSessions(JSON.parse(text));
              await app.refresh();
              toast.push(`Imported ${res.imported}, skipped ${res.skipped}`, 'ok');
            } catch (err) {
              toast.push((err as Error).message, 'err');
            }
          }}
        />
      </section>
      )}

      {tab === 'sessions' && (
      <div className="stack">
        {sessions.map((s) => {
          const done = (s.logs || []).filter((l) => l.status !== 'skipped').length;
          const skipped = (s.logs || []).length - done;
          const open = openId === s.id;
          const editing = editId === s.id;
          const hasPr = prSessionIds.has(s.id);
          return (
            <div key={s.id} className="page-panel">
              <div className="toolbar">
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ textAlign: 'left', flex: 1 }}
                  onClick={() => {
                    setOpenId(open ? null : s.id);
                    setEditId(null);
                  }}
                >
                  <span className="pill pill-slate">{s.dayKey}</span>{' '}
                  <span className="pill pill-green">{s.date}</span>
                  {hasPr ? <span className="pill pill-orange"> PR</span> : null}
                  <div style={{ fontWeight: 900, marginTop: 8 }}>
                    {open ? '▾' : '▸'} {s.dayTitle || 'Saved record'}
                  </div>
                  <div className="subtle">
                    {s.weekName} · {done} completed, {skipped} skipped
                  </div>
                </button>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => {
                      setOpenId(s.id);
                      setEditId(s.id);
                      setEditDraft({
                        date: s.date,
                        name: s.name,
                        sleep: s.sleep,
                        soreness: s.soreness,
                        logs: s.logs,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmId(s.id)}>
                    Delete
                  </button>
                </div>
              </div>
              {open && !editing ? (
                <div className="mt-5">
                  <div className="page-signals mb-3">
                    <div className="page-signal">
                      <span className="page-signal-label">Date</span>
                      <span className="page-signal-value" style={{ fontSize: '1rem' }}>{s.date}</span>
                    </div>
                    <div className="page-signal">
                      <span className="page-signal-label">Sleep</span>
                      <span className="page-signal-value">{s.sleep || '—'}</span>
                    </div>
                    <div className="page-signal">
                      <span className="page-signal-label">Soreness</span>
                      <span className="page-signal-value">{s.soreness || '—'}</span>
                    </div>
                    <div className="page-signal">
                      <span className="page-signal-label">Logs</span>
                      <span className="page-signal-value">{(s.logs || []).length}</span>
                    </div>
                  </div>
                  {s.aiOverallSummary ? (
                    <div className="page-panel mt-3" style={{ padding: 14 }}>
                      <span className="page-section-label">AI coach analysis</span>
                      <p style={{ margin: '8px 0 0', lineHeight: 1.55 }}>{s.aiOverallSummary}</p>
                    </div>
                  ) : (
                    <p className="subtle mt-3">No AI analysis available for this older record.</p>
                  )}
                  {(s.logs || []).map((l, i) => (
                    <div key={i} className="page-panel mt-3" style={{ padding: 14 }}>
                      <span className={`pill ${l.status === 'skipped' ? 'pill-rose' : 'pill-green'}`}>{l.status}</span>
                      <h4 style={{ margin: '8px 0' }}>
                        {i + 1}. {l.name}
                      </h4>
                      <p className="subtle">{l.target}</p>
                      {(l.sets || []).map((set) => (
                        <div key={set.s} className="page-list-item mt-3">
                          <b>Set {set.s}</b>
                          <span>
                            {set.w} × {set.r}
                            {set.rpe != null && set.rpe !== '' ? ` @ RPE ${set.rpe}` : ''}
                          </span>
                        </div>
                      ))}
                      {l.journal ? <p className="subtle mt-3">{l.journal}</p> : null}
                      {l.aiCoachComment ? <p className="mt-3" style={{ color: 'var(--accent)', fontWeight: 700 }}>AI Coach: {l.aiCoachComment}</p> : null}
                    </div>
                  ))}
                  <button type="button" className="btn btn-hot mt-4" onClick={() => void sendReport(s.id)}>
                    Send Email Report
                  </button>
                </div>
              ) : null}
              {editing ? (
                <div className="mt-5 stack">
                  <div className="grid-auto">
                    <input
                      className="input"
                      type="date"
                      value={String(editDraft.date || today())}
                      onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })}
                    />
                    <input
                      className="input"
                      value={String(editDraft.name || '')}
                      onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    />
                    <input
                      className="input"
                      type="number"
                      value={String(editDraft.sleep ?? '')}
                      onChange={(e) => setEditDraft({ ...editDraft, sleep: e.target.value })}
                      placeholder="Sleep"
                    />
                    <input
                      className="input"
                      type="number"
                      value={String(editDraft.soreness ?? '')}
                      onChange={(e) => setEditDraft({ ...editDraft, soreness: e.target.value })}
                      placeholder="Soreness"
                    />
                  </div>
                  <div className="mt-4 stack">
                    <h4 style={{ margin: '8px 0' }}>Exercises</h4>
                    {(editDraft.logs || []).map((log, i) => (
                      <div key={i} className="page-panel" style={{ padding: 12 }}>
                        <div className="row" style={{ marginBottom: 12 }}>
                          <input 
                            className="input" 
                            style={{ flex: 1 }} 
                            value={log.name} 
                            onChange={(e) => {
                              const logs = [...(editDraft.logs || [])];
                              logs[i] = { ...log, name: e.target.value };
                              setEditDraft({ ...editDraft, logs });
                            }} 
                          />
                          <button type="button" className="btn btn-soft" onClick={() => {
                              const logs = [...(editDraft.logs || [])];
                              logs.splice(i, 1);
                              setEditDraft({ ...editDraft, logs });
                          }}>Delete Exercise</button>
                        </div>
                        
                        <div className="stack" style={{ gap: 8 }}>
                          {(log.sets || []).map((set, setIndex) => (
                            <div key={setIndex} className="row">
                              <span style={{ width: 40, color: '#64748b' }}>Set {set.s}</span>
                              <input className="input" placeholder="Weight" value={set.w ?? ''} onChange={e => {
                                  const logs = [...(editDraft.logs || [])];
                                  const sets = [...log.sets];
                                  sets[setIndex] = { ...set, w: e.target.value };
                                  logs[i] = { ...log, sets };
                                  setEditDraft({ ...editDraft, logs });
                              }} style={{ flex: 1 }} />
                              <input className="input" placeholder="Reps" value={set.r ?? ''} onChange={e => {
                                  const logs = [...(editDraft.logs || [])];
                                  const sets = [...log.sets];
                                  sets[setIndex] = { ...set, r: e.target.value };
                                  logs[i] = { ...log, sets };
                                  setEditDraft({ ...editDraft, logs });
                              }} style={{ flex: 1 }} />
                              <input className="input" placeholder="RPE" value={set.rpe ?? ''} onChange={e => {
                                  const logs = [...(editDraft.logs || [])];
                                  const sets = [...log.sets];
                                  sets[setIndex] = { ...set, rpe: e.target.value };
                                  logs[i] = { ...log, sets };
                                  setEditDraft({ ...editDraft, logs });
                              }} style={{ flex: 1 }} />
                              <button type="button" className="btn btn-soft" onClick={() => {
                                  const logs = [...(editDraft.logs || [])];
                                  const sets = [...log.sets];
                                  sets.splice(setIndex, 1);
                                  sets.forEach((s, idx) => s.s = idx + 1);
                                  logs[i] = { ...log, sets };
                                  setEditDraft({ ...editDraft, logs });
                              }}>x</button>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="btn btn-soft mt-3" onClick={() => {
                            const logs = [...(editDraft.logs || [])];
                            const sets = [...(log.sets || [])];
                            sets.push({ s: sets.length + 1, w: '', r: '', rpe: '' });
                            logs[i] = { ...log, sets };
                            setEditDraft({ ...editDraft, logs });
                        }}>Add Set</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-soft mt-2 mb-4" onClick={() => {
                        const logs = [...(editDraft.logs || [])];
                        logs.push({ name: 'New Exercise', target: 'Other', status: 'completed', sets: [{ s: 1, w: '', r: '', rpe: '' }] });
                        setEditDraft({ ...editDraft, logs });
                    }}>Add Exercise</button>
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-hot"
                      onClick={async () => {
                        try {
                          await app.api.updateSession(s.id, { ...s, ...editDraft });
                          setEditId(null);
                          await app.refresh();
                          toast.push('Record updated', 'ok');
                        } catch (e) {
                          toast.push((e as Error).message, 'err');
                        }
                      }}
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={async () => {
                        try {
                          await app.api.updateSession(s.id, { ...s, ...editDraft });
                          await app.refresh();
                          await sendReport(s.id);
                          setEditId(null);
                        } catch (e) {
                          toast.push((e as Error).message, 'err');
                        }
                      }}
                    >
                      Save & Send
                    </button>
                    <button type="button" className="btn btn-soft" onClick={() => setEditId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {!sessions.length ? <div className="page-empty">No records saved for this week yet.</div> : null}
      </div>
      )}
      
      {tab === 'cardio' && (
        <div className="stack">
          {db.cardio.map(c => (
            <div key={c.id} className="page-panel">
               <div className="toolbar">
                  <div>
                    <strong>{c.date}</strong> - {c.activity}
                    <div className="subtle">{c.durationMinutes} mins {c.distance ? ` · ${c.distance}` : ''} {c.perceivedEffort ? ` · RPE ${c.perceivedEffort}` : ''}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={async () => {
                      try {
                        await app.api.deleteCardioSession(c.id);
                        await app.refresh();
                        toast.push('Cardio deleted', 'ok');
                      } catch (e) {
                        toast.push((e as Error).message, 'err');
                      }
                    }}
                  >
                    Delete
                  </button>
               </div>
               {c.notes && <p className="mt-2 subtle">{c.notes}</p>}
            </div>
          ))}
          {!db.cardio.length && <div className="page-empty">No cardio sessions logged.</div>}
          <section className="page-panel mt-4">
            <div className="page-panel-head">
              <div>
                <span className="page-section-label">New entry</span>
                <h3 style={{ margin: 0 }}>Log Cardio</h3>
              </div>
            </div>
            <form onSubmit={async (e) => {
               e.preventDefault();
               const form = e.target as HTMLFormElement;
               try {
                 await app.api.saveCardioSession({
                   id: crypto.randomUUID(),
                   date: (form.elements.namedItem('date') as HTMLInputElement).value,
                   activity: (form.elements.namedItem('activity') as HTMLInputElement).value,
                   durationMinutes: Number((form.elements.namedItem('duration') as HTMLInputElement).value),
                   distance: (form.elements.namedItem('distance') as HTMLInputElement).value,
                   perceivedEffort: (form.elements.namedItem('rpe') as HTMLInputElement).value,
                   notes: (form.elements.namedItem('notes') as HTMLInputElement).value,
                 });
                 await app.refresh();
                 toast.push('Cardio saved', 'ok');
                 form.reset();
               } catch (err) {
                 toast.push((err as Error).message, 'err');
               }
            }}>
              <div className="grid-2 mt-3">
                <input required name="date" type="date" className="input" defaultValue={today()} />
                <input required name="activity" type="text" className="input" placeholder="Activity (e.g. Running)" />
                <input required name="duration" type="number" className="input" placeholder="Duration (mins)" />
                <input name="distance" type="text" className="input" placeholder="Distance (optional)" />
                <input name="rpe" type="number" min="1" max="10" className="input" placeholder="RPE 1-10 (optional)" />
                <input name="notes" type="text" className="input" placeholder="Notes (optional)" />
              </div>
              <button type="submit" className="btn btn-hot mt-3">Save Cardio</button>
            </form>
          </section>
        </div>
      )}

      {tab === 'habits' && (
        <div className="stack">
          {db.habits.map(h => {
             const logs = db.habitLogs.filter(l => l.habitId === h.id);
             return (
               <div key={h.id} className="page-panel">
                 <div className="toolbar">
                   <h4 style={{ margin: 0 }}>{h.name}</h4>
                   <button
                     type="button"
                     className="btn btn-soft btn-sm"
                     onClick={async () => {
                       try {
                         await app.api.deleteHabit(h.id);
                         await app.refresh();
                         toast.push('Habit deleted', 'ok');
                       } catch (e) {
                         toast.push((e as Error).message, 'err');
                       }
                     }}
                   >
                     Delete
                   </button>
                 </div>
                 <p className="subtle">Target: {h.target} {h.unit} · Logs: {logs.length}</p>
                 <form className="row mt-3" onSubmit={async (e) => {
                   e.preventDefault();
                   const form = e.target as HTMLFormElement;
                   try {
                     await app.api.saveHabitLog({
                       id: crypto.randomUUID(),
                       habitId: h.id,
                       date: (form.elements.namedItem('date') as HTMLInputElement).value,
                       value: Number((form.elements.namedItem('value') as HTMLInputElement).value)
                     });
                     await app.refresh();
                     form.reset();
                   } catch(err) { toast.push((err as Error).message, 'err'); }
                 }}>
                   <input required name="date" type="date" className="input" defaultValue={today()} />
                   <input required name="value" type="number" step="any" className="input" placeholder={`Value (${h.unit})`} />
                   <button type="submit" className="btn btn-soft">Log</button>
                 </form>
               </div>
             );
          })}
          {!db.habits.length && <div className="page-empty">No active habits.</div>}
          <section className="page-panel mt-4">
             <div className="page-panel-head">
               <div>
                 <span className="page-section-label">Create</span>
                 <h3 style={{ margin: 0 }}>New Habit</h3>
               </div>
             </div>
             <form className="grid-auto mt-3" onSubmit={async (e) => {
               e.preventDefault();
               const form = e.target as HTMLFormElement;
               try {
                 await app.api.saveHabit({
                   id: crypto.randomUUID(),
                   name: (form.elements.namedItem('name') as HTMLInputElement).value,
                   target: Number((form.elements.namedItem('target') as HTMLInputElement).value),
                   unit: (form.elements.namedItem('unit') as HTMLInputElement).value,
                   active: true
                 });
                 await app.refresh();
                 toast.push('Habit added', 'ok');
                 form.reset();
               } catch (err) { toast.push((err as Error).message, 'err'); }
             }}>
               <input required name="name" type="text" className="input" placeholder="Habit name" />
               <input required name="target" type="number" step="any" className="input" placeholder="Target value" />
               <input required name="unit" type="text" className="input" placeholder="Unit (e.g. L, mins)" />
               <button type="submit" className="btn btn-hot">Add Habit</button>
             </form>
          </section>
        </div>
      )}

      <Modal
        open={Boolean(confirmId)}
        title="Delete record?"
        onClose={() => setConfirmId(null)}
        actions={
          <>
            <button type="button" className="btn btn-soft" onClick={() => setConfirmId(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (!confirmId) return;
                try {
                  await app.api.deleteSession(confirmId);
                  await app.refresh();
                  toast.push('Record deleted', 'ok');
                } catch (e) {
                  toast.push((e as Error).message, 'err');
                } finally {
                  setConfirmId(null);
                }
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p>This permanently removes the day record from your local database.</p>
      </Modal>
    </div>
  );
}
