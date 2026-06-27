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

/* ─── Send button with loading ring ────────────────────── */
function SendButton({ loading, disabled, onClick }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inside = false;
    const onMove = e => {
      if (!inside) return;
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top  + rect.height / 2);
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
      style={{ transition: 'transform .4s var(--spring), background .2s, box-shadow .2s' }}
    >
      {loading ? (
        <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          <circle cx="9" cy="9" r="7" fill="none" stroke="white" strokeWidth="2"
            strokeDasharray="44" strokeDashoffset="22"
            style={{ animation: 'spin .8s linear infinite', transformOrigin: 'center' }}
          />
        </svg>
      ) : (
        <span style={{ fontSize: 16 }}>↑</span>
      )}
    </button>
  );
}

/* ─── Character count ring ──────────────────────────────── */
function CharRing({ count, max = 500 }) {
  if (count === 0) return null;
  const r = 10, circ = 2 * Math.PI * r;
  const pct = Math.min(count / max, 1);
  const color = pct > 0.9 ? '#F87171' : pct > 0.7 ? '#EAB308' : 'rgba(249,115,22,0.6)';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.8 }}>
      <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <circle cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth="2"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset .2s, stroke .3s' }}
      />
    </svg>
  );
}

/* ─── Empty state — teal orb + orbiting suggestion chips ── */
function EmptyState({ repo, onSend }) {
  const [collapsed, setCollapsed] = useState(false);

  const handleChip = (s) => {
    setCollapsed(true);
    setTimeout(() => onSend(s), 300);
  };

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="app-chat-empty">
      {/* Teal orb */}
      <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="app-ai-orb" style={{ width: 100, height: 100 }}>
          <span style={{ fontSize: 36 }}>⬡</span>
        </div>

        {/* Orbiting chips */}
        {!prefersReduced && SUGGESTIONS.map((s, i) => (
          <div
            key={s}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              '--orbit-start': `${i * 72}deg`,
              '--orbit-dur': `${8 + i * 0.6}s`,
              '--orbit-delay': collapsed ? '0s' : `${-i * 1.6}s`,
              animation: collapsed
                ? 'none'
                : `orbit var(--orbit-dur) linear var(--orbit-delay) infinite`,
              transition: 'opacity .3s, transform .3s',
              opacity: collapsed ? 0 : 1,
              pointerEvents: collapsed ? 'none' : 'auto',
            }}
          >
            <button
              onClick={() => handleChip(s)}
              style={{
                transform: 'translate(-50%, -50%)',
                padding: '6px 12px', borderRadius: 99,
                background: 'rgba(17,13,26,0.85)',
                border: '1px solid rgba(249,115,22,0.2)',
                color: 'var(--w2)', fontSize: 11, cursor: 'pointer',
                whiteSpace: 'nowrap', backdropFilter: 'blur(8px)',
                fontFamily: 'var(--font)', fontWeight: 500,
                transition: 'all .2s',
                maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'; e.currentTarget.style.color = 'var(--w1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.2)'; e.currentTarget.style.color = 'var(--w2)'; }}
            >
              {s.length > 22 ? s.slice(0, 22) + '…' : s}
            </button>
          </div>
        ))}
      </div>

      <div className="app-empty-icon">◈ Bioluminescent AI</div>
      <div className="app-empty-title">
        Ask anything about{' '}
        <span style={{ color: 'var(--amber-glow)', fontFamily: 'var(--mono)' }}>{repo.name}</span>
      </div>
      <div className="app-empty-sub">
        Architecture · Logic · Data flow · Source citations
      </div>

      {/* Fallback flat chips for reduced motion or after collapse */}
      {prefersReduced && (
        <div className="app-suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s} className="app-suggestion"
              onClick={() => onSend(s)}
              style={{ animationDelay: `${i * 80}ms`, animation: 'cite-in .4s var(--spring) both' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Code block with line numbers + hover highlight ──── */
function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const [hovLine, setHovLine] = useState(-1);
  const lang = className?.replace('language-', '') || '';
  const code = String(children).trim();
  const lines = code.split('\n');

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{ margin: '10px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-3)', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 12px', background: 'rgba(249,115,22,0.08)', borderBottom: '1px solid var(--border)' }}>
        {lang && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--amber-glow)', letterSpacing: 1, flex: 1 }}>
            {lang}
          </span>
        )}
        <button
          onClick={copy}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 5,
            color: copied ? 'var(--bio-bright)' : 'var(--w4)',
            fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 8px', cursor: 'pointer',
            transition: 'all .2s',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {/* Code lines */}
      <div style={{ display: 'flex', overflow: 'auto' }}>
        <div style={{ padding: '12px 8px', minWidth: 36, background: 'rgba(0,0,0,0.2)', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--w4)', lineHeight: 1.6, userSelect: 'none', flexShrink: 0 }}>
          {lines.map((_, i) => (
            <div key={i} style={{ color: i === hovLine ? 'var(--amber-glow)' : 'var(--w4)' }}>{i + 1}</div>
          ))}
        </div>
        <pre style={{ margin: 0, padding: '12px 14px', flex: 1, background: 'transparent', border: 'none', overflow: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--w2)', lineHeight: 1.6 }}>
          {lines.map((line, i) => (
            <div
              key={i}
              onMouseEnter={() => setHovLine(i)}
              onMouseLeave={() => setHovLine(-1)}
              style={{
                background: i === hovLine ? 'rgba(249,115,22,0.06)' : 'transparent',
                borderLeft: i === hovLine ? '2px solid var(--amber-glow)' : '2px solid transparent',
                paddingLeft: 4, transition: 'all .15s',
              }}
            >
              {line}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

/* ─── Citation chip with hover preview ─────────────────── */
function CitationChip({ citation, index }) {
  const [expanded, setExpanded] = useState(false);
  const fileName = citation.file_path.split('/').pop();

  return (
    <div
      className="app-cite"
      style={{ animationDelay: `${index * 60}ms`, position: 'relative', cursor: 'pointer' }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      title={citation.file_path}
    >
      <span style={{ opacity: 0.6 }}>◉</span>{' '}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{fileName}</span>
      <span style={{ color: 'var(--amber-glow)', marginLeft: 4 }}>:{citation.start_line}–{citation.end_line}</span>

      {/* Hover preview */}
      {expanded && citation.content && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
          background: 'var(--obsidian)', border: '1px solid var(--border-2)',
          borderRadius: 8, padding: '8px 12px', zIndex: 100,
          minWidth: 240, maxWidth: 320,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'cite-in .15s var(--spring)',
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--amber-glow)', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
            {citation.file_path}
          </div>
          <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--w2)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', overflow: 'hidden', maxHeight: 80 }}>
            {(citation.content || '').split('\n').slice(0, 4).join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ─── Main ChatView ─────────────────────────────────────── */
export default function ChatView({ repo }) {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error,     setError]     = useState('');
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const inputWrapRef = useRef(null);

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
        {messages.length === 0 && <EmptyState repo={repo} onSend={send} />}

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

              {/* Citations — cascade in */}
              {m.citations?.length > 0 && (
                <div className="app-cites">
                  {m.citations.map((c, i) => (
                    <CitationChip key={i} citation={c} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {error && <div className="app-msg-error">⚠ {error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="app-input-bar">
        <div className="app-input-wrap" ref={inputWrapRef}>
          {/* Scanning border overlay */}
          <div className="app-input-scan">
            <div className="app-input-scan-beam" style={{ top: 0, left: 0, right: 0, height: 1 }} />
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
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
          Enter to send · Shift+Enter for newline · LLaMA 3.3 70B via Groq
        </div>
      </div>
    </div>
  );
}
