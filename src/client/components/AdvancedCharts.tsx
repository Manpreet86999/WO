import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppContext';

function mapTargetToCategory(target: string | undefined, name: string | undefined): string {
  const t = (target || name || '').toLowerCase();
  if (t.includes('chest') || t.includes('pec')) return 'Chest';
  if (t.includes('back') || t.includes('lat') || t.includes('rhomboid') || t.includes('row') || t.includes('pull')) return 'Back';
  if (t.includes('leg') || t.includes('quad') || t.includes('hamstring') || t.includes('calf') || t.includes('glute') || t.includes('squat')) return 'Legs';
  if (t.includes('shoulder') || t.includes('delt') || (t.includes('press') && t.includes('overhead'))) return 'Shoulders';
  if (t.includes('arm') || t.includes('bicep') || t.includes('tricep') || t.includes('curl') || t.includes('extension')) return 'Arms';
  if (t.includes('core') || t.includes('abs') || t.includes('oblique') || t.includes('crunch')) return 'Core';
  return 'Other';
}

export function AdvancedCharts() {
  const { db } = useApp();
  const radarRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let radarChart: any = null;
    let lineChart: any = null;

    void (async () => {
      try {
        const mod = await import('chart.js/auto');
        const Chart = mod.default;

        if (radarRef.current && db) {
          // Calculate volume (sets) per muscle group over last 14 days
          const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
          const categories: Record<string, number> = {
            Chest: 0, Back: 0, Legs: 0, Shoulders: 0, Arms: 0, Core: 0
          };

          const recentSessions = db.sessions.filter(s => new Date(s.date).getTime() >= fourteenDaysAgo && s.status === 'finished');
          for (const s of recentSessions) {
            for (const log of s.logs || []) {
              const cat = mapTargetToCategory(log.target, log.name);
              if (categories[cat] !== undefined) {
                const sets = (log.sets || []).filter(set => set.r && Number(set.r) > 0).length;
                categories[cat] += sets;
              }
            }
          }

          radarChart = new Chart(radarRef.current, {
            type: 'radar',
            data: {
              labels: Object.keys(categories),
              datasets: [{
                label: 'Sets (Last 14 Days)',
                data: Object.values(categories),
                backgroundColor: 'rgba(239, 68, 68, 0.2)', // red-500
                borderColor: '#ef4444',
                pointBackgroundColor: '#ef4444',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#ef4444'
              }]
            },
            options: {
              responsive: true,
              scales: {
                r: {
                  beginAtZero: true,
                  grid: { color: 'rgba(255, 255, 255, 0.1)' },
                  pointLabels: { color: 'rgba(255, 255, 255, 0.7)' },
                  ticks: { display: false }
                }
              },
              plugins: { legend: { display: false } }
            }
          });
        }

        if (lineRef.current && db) {
          // Readiness trend
          const recentReadiness = db.readiness.slice(-14);
          
          lineChart = new Chart(lineRef.current, {
            type: 'line',
            data: {
              labels: recentReadiness.map(r => r.date.slice(5)), // MM-DD
              datasets: [{
                label: 'Readiness Score',
                data: recentReadiness.map(r => r.score),
                borderColor: '#3b82f6', // blue-500
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
              }]
            },
            options: {
              responsive: true,
              scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
              },
              plugins: { legend: { display: false } }
            }
          });
        }
      } catch (e) {
        console.error('Failed to load charts', e);
      }
    })();

    return () => {
      radarChart?.destroy();
      lineChart?.destroy();
    };
  }, [db]);

  return (
    <div className="grid-auto">
      <div className="glass card p-4 flex flex-col justify-center items-center">
        <h4 style={{ margin: '0 0 16px 0', textAlign: 'center' }}>Muscle Fatigue (Volume)</h4>
        <canvas ref={radarRef} style={{ maxHeight: '250px' }}></canvas>
      </div>
      <div className="glass card p-4 flex flex-col justify-center items-center">
        <h4 style={{ margin: '0 0 16px 0', textAlign: 'center' }}>Readiness Trend</h4>
        <canvas ref={lineRef} style={{ maxHeight: '250px' }}></canvas>
      </div>
    </div>
  );
}
