import { useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '../components/Toast';
import { useApp } from '../state/AppContext';
import { today } from '../lib/utils';
import { AdvancedCharts } from '../components/AdvancedCharts';
import type { Measurement } from '../lib/types';

type MetricKey = 'weight' | 'bodyFat' | 'waist' | 'muscleMass' | 'waterPercentage';

const METRIC_OPTS: { key: MetricKey; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'bodyFat', label: 'Body fat %' },
  { key: 'waist', label: 'Waist' },
  { key: 'muscleMass', label: 'Muscle mass' },
  { key: 'waterPercentage', label: 'Water %' },
];

const emptyForm = () => ({
  id: '',
  date: today(),
  weight: '',
  waist: '',
  neck: '',
  chest: '',
  arms: '',
  hips: '',
  bmr: '',
  bodyFat: '',
  muscleMass: '',
  waterPercentage: '',
});

function navyBodyFat(
  gender: 'male' | 'female' | undefined,
  waist: number,
  neck: number,
  height: number,
  units: 'kg' | 'lb',
  hips?: number,
): number | null {
  if (!(waist > 0 && neck > 0 && height > 0)) return null;
  const in_w = units === 'kg' ? waist / 2.54 : waist;
  const in_n = units === 'kg' ? neck / 2.54 : neck;
  const in_h = units === 'kg' ? height / 2.54 : height;
  if (gender === 'female') {
    const in_hips = hips ? (units === 'kg' ? hips / 2.54 : hips) : 0;
    if (!(in_hips > 0) || in_w + in_hips <= in_n) return null;
    const bf =
      163.205 * Math.log10(in_w + in_hips - in_n) - 97.684 * Math.log10(in_h) - 78.387;
    return bf > 0 && bf < 60 ? bf : null;
  }
  if (in_w <= in_n) return null;
  const bf = 86.01 * Math.log10(in_w - in_n) - 70.041 * Math.log10(in_h) + 36.76;
  return bf > 0 && bf < 60 ? bf : null;
}

export function Body() {
  const app = useApp();
  const toast = useToast();
  const { db, analytics, settings } = app;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [form, setForm] = useState(emptyForm());
  const [metric, setMetric] = useState<MetricKey>('weight');
  const [editing, setEditing] = useState(false);
  const height = db?.profile?.height;
  const units = db?.profile?.units || 'kg';
  const gender = settings?.gender;

  const sorted = useMemo(
    () => [...(db?.measurements || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [db?.measurements],
  );

  const deltas = analytics?.bodyDeltas;

  // Navy BF auto-calc
  useEffect(() => {
    if (!form.waist || !form.neck || !height) return;
    const bf = navyBodyFat(
      gender,
      Number(form.waist),
      Number(form.neck),
      Number(height),
      units,
      form.hips ? Number(form.hips) : undefined,
    );
    if (bf != null) {
      setForm((f) => ({ ...f, bodyFat: bf.toFixed(1) }));
    }
  }, [form.waist, form.neck, form.hips, height, units, gender]);

  useEffect(() => {
    let chart: { destroy: () => void } | null = null;
    void (async () => {
      try {
        const mod = await import('chart.js/auto');
        const Chart = mod.default;
        if (!canvasRef.current) return;
        const labels = sorted.map((m) => m.date);
        const data = sorted.map((m) => Number(m[metric]) || 0);
        chart = new Chart(canvasRef.current, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                data,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37,99,235,.12)',
                fill: true,
                tension: 0.3,
              },
            ],
          },
          options: { plugins: { legend: { display: false } }, responsive: true },
        });
      } catch {
        /* chart optional */
      }
    })();
    return () => chart?.destroy();
  }, [sorted, metric]);

  if (!db) return null;

  function loadEdit(m: Measurement) {
    setForm({
      id: m.id,
      date: m.date || today(),
      weight: String(m.weight ?? ''),
      waist: String(m.waist ?? ''),
      neck: String(m.neck ?? ''),
      chest: String(m.chest ?? ''),
      arms: String(m.arms ?? ''),
      hips: String(m.hips ?? ''),
      bmr: String(m.bmr ?? ''),
      bodyFat: String(m.bodyFat ?? ''),
      muscleMass: String(m.muscleMass ?? ''),
      waterPercentage: String(m.waterPercentage ?? ''),
    });
    setEditing(true);
  }

  async function save() {
    try {
      if (!height && form.waist && form.neck) {
        toast.push('Set your height in Settings for Navy body-fat calc', 'info');
      }
      await app.api.saveMeasurement({
        ...(form.id ? { id: form.id } : {}),
        date: form.date,
        weight: form.weight,
        waist: form.waist,
        neck: form.neck,
        chest: form.chest,
        arms: form.arms,
        hips: form.hips,
        bmr: form.bmr,
        bodyFat: form.bodyFat,
        muscleMass: form.muscleMass,
        waterPercentage: form.waterPercentage,
      });
      setForm(emptyForm());
      setEditing(false);
      await app.refresh();
      toast.push(editing ? 'Measurement updated' : 'Measurement saved', 'ok');
    } catch (e) {
      toast.push((e as Error).message, 'err');
    }
  }

  function deltaLabel(d?: { latest: number; previous?: number; delta30d?: number }, unit = '') {
    if (!d) return '—';
    const parts = [`${d.latest}${unit}`];
    if (d.previous != null) {
      const diff = Math.round((d.latest - d.previous) * 10) / 10;
      parts.push(`${diff > 0 ? '+' : ''}${diff} vs prev`);
    }
    if (d.delta30d != null) {
      parts.push(`${d.delta30d > 0 ? '+' : ''}${d.delta30d} /30d`);
    }
    return parts.join(' · ');
  }

  return (
    <div className="fade page-shell">
      <header className="page-hero">
        <div>
          <span className="page-eyebrow">Composition</span>
          <h1 className="page-title">Body</h1>
          <p className="page-sub">
            Measurements, multi-metric trends, and Navy body-fat — private to this device.
          </p>
        </div>
      </header>

      <div className="page-signals">
        <div className="page-signal">
          <span className="page-signal-label">Weight</span>
          <span className="page-signal-value" style={{ fontSize: '1rem' }}>
            {deltaLabel(deltas?.weight, ` ${units}`)}
          </span>
        </div>
        <div className="page-signal">
          <span className="page-signal-label">Body fat</span>
          <span className="page-signal-value" style={{ fontSize: '1rem' }}>
            {deltaLabel(deltas?.bodyFat, '%')}
          </span>
        </div>
        <div className="page-signal">
          <span className="page-signal-label">Waist</span>
          <span className="page-signal-value" style={{ fontSize: '1rem' }}>
            {deltaLabel(deltas?.waist)}
          </span>
        </div>
      </div>

      <div className="page-panel" style={{ overflow: 'hidden', padding: 0 }}>
        <AdvancedCharts />
      </div>

      <div className="page-panel stack">
        <div className="page-panel-head">
          <div>
            <p className="page-section-label">{editing ? 'Update' : 'Log'}</p>
            <h3>{editing ? 'Edit measurement' : 'Log measurement'}</h3>
          </div>
        </div>
        <div className="grid-auto">
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Weight"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Waist"
            value={form.waist}
            onChange={(e) => setForm({ ...form, waist: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Neck"
            value={form.neck}
            onChange={(e) => setForm({ ...form, neck: e.target.value })}
          />
          {gender === 'female' ? (
            <input
              className="input"
              type="number"
              placeholder="Hips (Navy female)"
              value={form.hips}
              onChange={(e) => setForm({ ...form, hips: e.target.value })}
            />
          ) : null}
          <input
            className="input"
            type="number"
            placeholder="Chest"
            value={form.chest}
            onChange={(e) => setForm({ ...form, chest: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Arms"
            value={form.arms}
            onChange={(e) => setForm({ ...form, arms: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="BMR (kcal)"
            value={form.bmr}
            onChange={(e) => setForm({ ...form, bmr: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Body Fat %"
            value={form.bodyFat}
            onChange={(e) => setForm({ ...form, bodyFat: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Muscle Mass"
            value={form.muscleMass}
            onChange={(e) => setForm({ ...form, muscleMass: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Water %"
            value={form.waterPercentage}
            onChange={(e) => setForm({ ...form, waterPercentage: e.target.value })}
          />
        </div>
        <div className="row">
          <button type="button" className="btn btn-hot" onClick={() => void save()}>
            {editing ? 'Update' : 'Save'}
          </button>
          {editing ? (
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                setForm(emptyForm());
                setEditing(false);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="page-panel">
        <div className="page-panel-head">
          <div>
            <p className="page-section-label">Chart</p>
            <h3>Trend</h3>
          </div>
          <div className="page-tabs">
            {METRIC_OPTS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`page-tab ${metric === m.key ? 'active' : ''}`}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <canvas ref={canvasRef} height={140} />
      </div>

      <div className="page-panel stack">
        <div className="page-panel-head">
          <div>
            <p className="page-section-label">Recovery</p>
            <h3>Pain / injury log</h3>
            <p className="subtle" style={{ margin: '4px 0 0' }}>
              Timeline of body regions — feeds deload signals.
            </p>
          </div>
        </div>
        <form
          className="grid-auto"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await app.api.savePainLog({
                id: crypto.randomUUID(),
                date: String(fd.get('date') || today()),
                region: String(fd.get('region') || ''),
                severity: Number(fd.get('severity') || 1),
                notes: String(fd.get('notes') || ''),
                affectsTraining: fd.get('affects') === 'on',
              });
              await app.refresh();
              toast.push('Pain log saved', 'ok');
              e.currentTarget.reset();
            } catch (err) {
              toast.push((err as Error).message, 'err');
            }
          }}
        >
          <input className="input" type="date" name="date" defaultValue={today()} />
          <input className="input" name="region" required placeholder="Region (e.g. Left shoulder)" />
          <input className="input" type="number" name="severity" min={1} max={10} defaultValue={3} placeholder="Severity 1-10" />
          <input className="input" name="notes" placeholder="Notes" />
          <label className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="affects" defaultChecked /> Affects training
          </label>
          <button type="submit" className="btn btn-hot">
            Log pain
          </button>
        </form>
        <div className="page-list">
          {(db.painLogs || []).slice(0, 8).map((p) => (
            <div key={p.id} className="page-list-item">
              <div>
                <b>{p.date}</b> · {p.region} · sev {p.severity}
                <div className="subtle" style={{ fontSize: 12 }}>
                  {p.notes}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={async () => {
                  await app.api.deletePainLog(p.id);
                  await app.refresh();
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="page-list">
        {[...sorted].reverse().map((m) => (
          <div key={m.id} className="page-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div className="toolbar">
              <span className="pill pill-blue">{m.date}</span>
              <div className="row">
                <button type="button" className="btn btn-soft btn-sm" onClick={() => loadEdit(m)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={async () => {
                    try {
                      await app.api.deleteMeasurement(m.id);
                      await app.refresh();
                      toast.push('Deleted', 'ok');
                    } catch (e) {
                      toast.push((e as Error).message, 'err');
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="subtle" style={{ margin: 0 }}>
              Weight: <strong>{m.weight}</strong>
              {m.bodyFat ? ` · BF%: ${m.bodyFat}%` : ''}
              {m.bmr ? ` · BMR: ${m.bmr}` : ''}
              {m.muscleMass ? ` · Muscle: ${m.muscleMass}` : ''}
              {m.waterPercentage ? ` · Water: ${m.waterPercentage}%` : ''}
              <br />
              Waist {m.waist || '-'} · Neck {m.neck || '-'} · Chest {m.chest || '-'} · Arms{' '}
              {m.arms || '-'}
              {m.hips ? ` · Hips ${m.hips}` : ''}
            </p>
          </div>
        ))}
        {!sorted.length ? <div className="page-empty">No measurements yet.</div> : null}
      </div>
    </div>
  );
}
