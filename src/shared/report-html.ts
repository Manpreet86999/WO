import type { AppDb, Session } from './types.js';
import { computeMetrics } from './metrics.js';
import { formatWorkoutSet } from './workout-entry.js';
export function escapeReportText(value:unknown):string{return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
function table(headers:string[],rows:unknown[][]){return `<table><thead><tr>${headers.map(h=>`<th>${escapeReportText(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${escapeReportText(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
export function reportHtml(data:AppDb,kind:'progress'|'session'|'week',id?:string):string {
  let sessions:Session[]=data.sessions.filter(s=>s.status==='finished');
  if(kind==='session')sessions=sessions.filter(s=>s.id===id);
  if(kind==='week')sessions=sessions.filter(s=>s.weekId===id);
  if(kind!=='progress'&&!sessions.length)throw new Error('No completed sessions are available for this report.');
  const units=data.profile.units,metrics=computeMetrics({...data,sessions});
  const title=kind==='session'?sessions[0].dayTitle:kind==='week'?data.weeks.find(w=>w.id===id)?.name||'Week report':'Progress report';
  const summary=table(['Completed sessions',`Working volume (${units})`,'Average minutes'],[[metrics.totals.sessions,metrics.totals.tonnage.toFixed(1),metrics.totals.avgSessionMinutes||0]]);
  const details=sessions.map(s=>`<section><h2>${escapeReportText(s.date)} · ${escapeReportText(s.dayTitle)}</h2><p>${escapeReportText(s.notes)}</p><p>${escapeReportText(s.aiOverallSummary)}</p>${table(['Exercise','Status','Sets','Notes','Coach comment'],s.logs.map(log=>[log.name,log.status,log.sets.map(set=>formatWorkoutSet(set,units)).join('; '),log.journal||'',log.aiCoachComment||'']))}</section>`).join('');
  const strength=table(['Exercise',`Estimated 1RM (${units})`,'Date'],metrics.personalRecords.map(p=>[p.exercise,p.bestE1rm,p.date]));
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#17211b;font-size:11px}h1{font-size:24px}h2{font-size:15px;margin-top:22px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:8px;border:1px solid #ccd5cf;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eef3ee}tr{break-inside:avoid}thead{display:table-header-group}p{line-height:1.5}.muted{color:#53645a}</style></head><body><p>BODY OS</p><h1>${escapeReportText(title)}</h1><p>${escapeReportText(data.profile.displayName)} · Generated ${escapeReportText(new Date().toISOString())}</p>${summary}<h2>Strength estimates</h2>${strength}<p class="muted">Estimated strength is calculated from logged sets and is not a tested maximum. Missing records are not filled with assumed results.</p>${details}</body></html>`;
}
