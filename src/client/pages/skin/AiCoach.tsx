import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../components/Toast';

const CHAT_KEY = 'body-os-skin-coach';
const MAX_CHAT = 40;

const QUICK = [
  'Build my AM and PM routine from my products',
  'Analyze my latest log and fix the routine',
  'What should I pause this week?',
  'Help me set my skin type and concerns',
];

export function SkinAi() {
  const app = useApp();
  const toast = useToast();
  const { settings, setPage, refreshSkin } = app;
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const [chat, setChat] = useState<Array<{ role: 'user' | 'ai'; content: string; model?: string; actions?: string[] }>>(() => {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-MAX_CHAT)));
    } catch {
      /* ignore */
    }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [chat]);

  const isAiEnabled = settings?.hasAiApiKey || settings?.aiProvider === 'ollama';

  async function ask(text = question) {
    const q = text.trim();
    if (!q || busy) return;
    setQuestion('');
    const history = chat.map(({ role, content }) => ({ role, content }));
    setChat((h) => [...h, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await app.api.skinCoachAsk(q, history);
      if (!res.ok) {
        toast.push(res.error || 'Ask failed', 'err');
        setChat((h) => [...h, { role: 'ai', content: res.error || 'Ask failed' }]);
        return;
      }
      setChat((h) => [...h, { role: 'ai', content: res.answer || '', model: res.model, actions: res.actions }]);
      await refreshSkin();
    } catch (e) {
      toast.push((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade skin-chat-page">
      <header className="skin-chat-head">
        <div>
          <span className="page-eyebrow">Skincare</span>
          <h1 className="page-title">Coach</h1>
          <p className="page-sub">
            {isAiEnabled
              ? `${settings?.aiProvider} · talks, then changes your routine`
              : 'Local engine on — add an API key in Settings for a smarter coach'}
          </p>
        </div>
        {!isAiEnabled ? (
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setPage('Settings')}>
            Setup AI
          </button>
        ) : null}
      </header>

      <div className="skin-chat-quick">
        {QUICK.map((q) => (
          <button key={q} type="button" className="chip" disabled={busy} onClick={() => void ask(q)}>
            {q}
          </button>
        ))}
      </div>

      <div className="skin-chat-thread" ref={scroller}>
        {chat.length === 0 ? (
          <div className="skin-chat-empty">
            <p>Tell me what you own, how your skin feels, or ask me to build the routine.</p>
            <p className="subtle">I search your shelf, link products, and rewrite AM/PM. After you log, I comment and pause actives if the barrier is angry.</p>
          </div>
        ) : (
          chat.map((m, i) => (
            <div key={i} className={`skin-bubble ${m.role}`}>
              <span className="page-eyebrow">{m.role === 'user' ? 'You' : m.model || 'Coach'}</span>
              <p>{m.content}</p>
            </div>
          ))
        )}
        {busy ? <div className="skin-bubble ai"><span className="page-eyebrow">Coach</span><p>Working…</p></div> : null}
      </div>

      <form
        className="skin-chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <input
          className="input"
          value={question}
          placeholder="Build my routine / analyze today / what should I pause…"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="btn btn-hot" type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </div>
  );
}
