import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamChatResponse } from '../services/api';

const SUGGESTIONS = [
  'How does the main execution pipeline work?',
  'What is the overall architecture?',
  'Explain the authentication flow',
  'What are the core data models?',
  'What does this repo actually do?',
];

/* ─── Ring progress send button ────────────────────────── */
function SendButton({ loading, disabled, onClick }) {
  const ref = useRef(null);

  // Magnetic effect
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inside = false;
    const onMove = e => {
      if (!inside) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 40) {
        const s = (40 - dist) / 40;
        el.style.transform = `translate(${dx*s*0.3}px,${dy*s*0.3}px)`;
      }
    };
    const onEnter = () => { inside = true; };
    const onLeave = () => { inside = false; el.style.transform = ''; };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    document.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <button
      ref={ref}
      className="app-btn-send"
      onClick={onClick}
      disabled={disabled}
      style={{ transition:'transform .4s var(--spring), background .2s, box-shadow .2s' }}
    >
      {loading ? (
        <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          <circle cx="9" cy="9" r="7" fill="none" stroke="white" strokeWidth="2"
            strokeDasharray="44" strokeDashoffset="22"
            style={{ animation:'spin .8s linear infinite', transformOrigin:'center' }}
          />
        </svg>
      ) : (
        <span style={{ fontSize:16 }}>↑</span>
      )}
    </button>
  );
}

/* ─── Character count ring ──────────────────────────────── */
function CharRing({ count, max = 500 }) {
  if (count === 0) return null;
  const r = 10, circ = 2 * Math.PI * r;
  const pct = Math.min(count / max, 1);
  const color = pct > 0.9 ? '#F87171' : pct > 0.7 ? '#FBBF24' : 'rgba(99,102,241,0.6)';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ flexShrink:0, opacity:0.8 }}>
      <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <circle cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth="2"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transform:'rotate(-90deg)', transformOrigin:'center', transition:'stroke-dashoffset .2s, stroke .3s' }}
      />
    </svg>
  );
}

/* ─── Empty state with orbital suggestions ──────────────── */
function EmptyState({ onSend }) {
  return (
    <div className="app-chat-empty">
      {/* Pulsing AI orb */}
      <div className="app-ai-orb">⬡</div>

      <div className="app-empty-icon">◈ AI Terminal</div>
      <div className="app-empty-title">Ready for queries</div>
      <div className="app-empty-sub">
        Ask anything about the codebase — architecture, logic,
        data flow — with source citations.
      </div>

      <div className="app-suggestions">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s}
            className="app-suggestion"
            onClick={() => onSend(s)}
            style={{ animationDelay:`${i * 80}ms`, animation:'cite-in .4s var(--spring) both' }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Code block with line numbers ─────────────────────── */
function CodeBlock({ children, className }) {
  const lang = className?.replace('language-', '') || '';
  const code = String(children).trim();
  const lines = code.split('\n');
  return (
    <div style={{ margin:'10px 0', borderRadius:8, overflow:'hidden', border:'1px solid var(--border)', background:'var(--bg-3)' }}>
      {lang && (
        <div style={{ padding:'4px 12px', background:'rgba(99,102,241,0.1)', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:10, color:'var(--indigo-2)', letterSpacing:1 }}>
          {lang}
        </div>
      )}
      <div style={{ display:'flex', overflow:'auto' }}>
        <div style={{ padding:'12px 8px', minWidth:36, background:'rgba(0,0,0,0.2)', textAlign:'right', fontFamily:'var(--mono)', fontSize:11, color:'var(--w4)', lineHeight:1.6, userSelect:'none', flexShrink:0 }}>
          {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <pre style={{ margin:0, padding:'12px 14px', flex:1, background:'transparent', border:'none', overflow:'auto', fontFamily:'var(--mono)', fontSize:12, color:'var(--w2)', lineHeight:1.6 }}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default function ChatView({ repo }) {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error,     setError]     = useState('');
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { setMessages([]); setError(''); }, [repo.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || streaming) return;
    setInput(''); setError('');
    textareaRef.current?.focus();

    const uid = Date.now(), aid = uid + 1;
    setMessages(p => [...p,
      { id: uid, role: 'user',      content: msg },
      { id: aid, role: 'assistant', content: '', citations: [], streaming: true },
    ]);
    setStreaming(true);

    await streamChatResponse({
      repositoryId: repo.id,
      message:      msg,
      onToken:     t => setMessages(p => p.map(m => m.id === aid ? { ...m, content: m.content + t } : m)),
      onCitations: c => setMessages(p => p.map(m => m.id === aid ? { ...m, citations: c, streaming: false } : m)),
      onError:     e => { setMessages(p => p.filter(m => m.id !== aid)); setError(e); },
    });

    setMessages(p => p.map(m => m.id === aid ? { ...m, streaming: false } : m));
    setStreaming(false);
  }, [input, streaming, repo.id]);

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="app-chat">
      <div className="app-chat-scroll">
        {messages.length === 0 && <EmptyState onSend={send} />}

        {messages.map(m => (
          <div key={m.id} className={`app-msg ${m.role}`}>
            <div className="app-msg-avatar">
              {m.role === 'assistant' ? '⬡' : 'You'}
            </div>
            <div className="app-msg-body">
              <div className="app-msg-bubble">
                {m.role === 'assistant' ? (
                  <>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          return inline
                            ? <code className={className} {...props}>{children}</code>
                            : <CodeBlock className={className}>{children}</CodeBlock>;
                        },
                      }}
                    >
                      {m.content || ' '}
                    </ReactMarkdown>
                    {m.streaming && <span className="app-msg-cursor" />}
                  </>
                ) : (
                  m.content
                )}
              </div>

              {/* Citations fly-in */}
              {m.citations?.length > 0 && (
                <div className="app-cites">
                  {m.citations.map((c, i) => (
                    <div
                      key={i}
                      className="app-cite"
                      title={c.file_path}
                    >
                      <span style={{ opacity:0.6 }}>◉</span>{' '}
                      {c.file_path.split('/').pop()}:{c.start_line}–{c.end_line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {error && <div className="app-msg-error">⚠ {error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="app-input-bar">
        <div className="app-input-wrap">
          <textarea
            ref={textareaRef} rows={1}
            placeholder={`query ${repo.name}://`}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={onKey}
            disabled={streaming}
          />
          <CharRing count={input.length} />
          <SendButton
            loading={streaming}
            disabled={streaming || !input.trim()}
            onClick={() => send()}
          />
        </div>
        <div className="app-input-hint">
          Enter to send · Shift+Enter for newline · Llama 3.3 70B · Groq
        </div>
      </div>
    </div>
  );
}
