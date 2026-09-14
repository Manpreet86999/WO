import { useEffect, useRef, useState } from 'react';

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.start();
    setTimeout(() => {
      o.stop();
      void ctx.close();
    }, 180);
  } catch {
    /* ignore */
  }
}

export function RestTimer({
  defaultSeconds = 90,
  autoStart = false,
  kick = 0,
}: {
  defaultSeconds?: number;
  autoStart?: boolean;
  kick?: number;
}) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(defaultSeconds);
  const doneOnce = useRef(false);

  useEffect(() => {
    setSeconds(defaultSeconds);
    setLeft(defaultSeconds);
    doneOnce.current = false;
    if (autoStart || kick > 0) {
      setRunning(true);
    }
  }, [defaultSeconds, kick, autoStart]);

  useEffect(() => {
    if (!running) return;
    if (left <= 0) {
      setRunning(false);
      if (!doneOnce.current) {
        doneOnce.current = true;
        if (navigator.vibrate) navigator.vibrate([140, 80, 140, 80, 200]);
        beep();
      }
      return;
    }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [running, left]);

  const mm = String(Math.floor(Math.max(0, left) / 60)).padStart(2, '0');
  const ss = String(Math.max(0, left) % 60).padStart(2, '0');
  const done = left <= 0 && !running;

  return (
    <div className={`rest-timer ${done ? 'done' : ''}`}>
      <div>
        <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: '0.08em' }}>REST TIMER</div>
        <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {mm}:{ss}
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {[60, 90, 120, 180].map((s) => (
          <button
            key={s}
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => {
              setSeconds(s);
              setLeft(s);
              doneOnce.current = false;
              setRunning(true);
            }}
          >
            {s}s
          </button>
        ))}
        <button
          type="button"
          className="btn btn-hot btn-sm"
          onClick={() => {
            if (left <= 0) {
              setLeft(seconds);
              doneOnce.current = false;
            }
            setRunning((r) => !r);
          }}
        >
          {running ? 'Pause' : left <= 0 ? 'Restart' : 'Start'}
        </button>
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={() => {
            setLeft(seconds);
            setRunning(false);
            doneOnce.current = false;
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
