import { useApp } from '../state/AppContext';
import { summarizeHealth } from '../../shared/health';
import { localDateKey } from '../../shared/evidence';
export function HealthReadings() {
  const { db } = useApp();
  const readings = db?.healthReadings || [];
  if (!readings.length) return null;
  const latestDate = readings.map(r => r.date).sort().at(-1)!;
  const values = summarizeHealth(readings,latestDate);
  return <section className="glass card stack"><h3>Connected health data</h3><p className="subtle">Recorded by your connected apps · {latestDate}{latestDate !== localDateKey() ? ' · not today' : ''}. Sources remain separate; imported readings do not overwrite your check-in.</p>
    {values.map(v => <p key={`${v.kind}:${v.source}`}><strong>{v.kind}: {v.value == null ? 'Overlapping or multi-day records — review source' : `${Math.round(v.value*10)/10} ${v.unit}`}</strong><br/><small>{v.source} · imported {new Date(v.importedAt).toLocaleString()}</small></p>)}
  </section>;
}
