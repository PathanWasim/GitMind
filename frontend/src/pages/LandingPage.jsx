import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ThreeBackground from '../components/ThreeBackground';
import '../index.css';

/* ─── Custom cursor ─────────────────────────────────────── */
function CustomCursor() {
  const dot  = useRef(null);
  const ring = useRef(null);

  useEffect(() => {
    let dx = 0, dy = 0, rx = 0, ry = 0, id;

    const move  = e => { dx = e.clientX; dy = e.clientY; };
    const down  = () => ring.current?.classList.add('clicking');
    const up    = () => ring.current?.classList.remove('clicking');
    const enter = () => { dot.current?.classList.add('hovering'); ring.current?.classList.add('hovering'); };
    const leave = () => { dot.current?.classList.remove('hovering'); ring.current?.classList.remove('hovering'); };

    document.addEventListener('mousemove', move);
    document.addEventListener('mousedown', down);
    document.addEventListener('mouseup', up);

    const tick = () => {
      id = requestAnimationFrame(tick);
      rx += (dx - rx) * 0.12;
      ry += (dy - ry) * 0.12;
      if (dot.current)  { dot.current.style.left  = `${dx}px`; dot.current.style.top  = `${dy}px`; }
      if (ring.current) { ring.current.style.left = `${rx}px`; ring.current.style.top = `${ry}px`; }
    };
    tick();

    const addHover = () => {
      document.querySelectorAll('a,button,[data-hover]').forEach(el => {
        el.addEventListener('mouseenter', enter);
        el.addEventListener('mouseleave', leave);
      });
    };
    addHover();
    const mo = new MutationObserver(addHover);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('mouseup', up);
      mo.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={dot}  className="cursor-dot" />
      <div ref={ring} className="cursor-ring" />
    </>
  );
}

/* ─── Scroll reveal hook ────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal, .reveal-up').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ─── Magnetic button ───────────────────────────────────── */
function MagneticBtn({ children, className, onClick, style }) {
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
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 70) {
        const s = (70 - dist) / 70;
        el.style.transform = `translate(${dx * s * 0.35}px,${dy * s * 0.35}px)`;
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
    <button ref={ref} className={className} onClick={onClick}
      style={{ ...style, transition: 'transform .4s var(--spring), box-shadow .25s, background .2s' }}>
      {children}
    </button>
  );
}

/* ─── 3D Tilt card ──────────────────────────────────────── */
function Tilt({ children, className, style }) {
  const ref = useRef(null);
  const onMove = e => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    ref.current.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
    ref.current.style.setProperty('--my', `${(y + 0.5) * 100}%`);
    ref.current.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(8px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <div ref={ref} className={className} style={{ ...style, transition: 'transform .45s var(--ease)' }}
      onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

/* ─── Count-up stat ─────────────────────────────────────── */
function CountUp({ target, prefix = '', suffix = '' }) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      setStarted(true);
      obs.disconnect();
      const num = parseFloat(String(target).replace(/[^0-9.]/g, '')) || 0;
      if (num === 0) { setValue(target); return; }
      const dur = 1600, steps = 60;
      let step = 0;
      const t = setInterval(() => {
        step++;
        const ease = 1 - Math.pow(1 - step / steps, 3);
        const cur = num * ease;
        setValue(Number.isInteger(num) ? Math.round(cur) : cur.toFixed(1));
        if (step >= steps) { setValue(target); clearInterval(t); }
      }, dur / steps);
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, started]);

  return <span ref={ref}>{prefix}{value}{suffix}</span>;
}

/* ─── Mini visualizations ───────────────────────────────── */
function MiniTerminal() {
  const [lines, setLines] = useState([]);
  const all = [
    { text: '$ git clone https://github.com/org/repo', color: 'var(--amber-glow)' },
    { text: 'Cloning into repo...', color: 'var(--w3)' },
    { text: 'Scanning 147 files...', color: 'var(--w3)' },
    { text: '[████████░░] 80%  chunking', color: 'var(--bio-bright)' },
    { text: '[██████████] 100% ✓ indexed', color: 'var(--plasma-gold)' },
  ];
  useEffect(() => {
    let i = 0;
    const tick = () => {
      if (i < all.length) {
        setLines(p => [...p, all[i++]]);
        setTimeout(tick, 500 + Math.random() * 300);
      } else {
        setTimeout(() => { setLines([]); i = 0; tick(); }, 2000);
      }
    };
    tick();
  }, []);
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.8 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.color, animation: 'lineSlide .2s ease both' }}>{l.text}</div>
      ))}
      <span style={{ display:'inline-block', width:5, height:10, background:'var(--amber-glow)', verticalAlign:'middle', animation:'blink .9s step-end infinite' }} />
    </div>
  );
}

function MiniScannerBeam() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % 6), 700);
    return () => clearInterval(t);
  }, []);
  const lines = [
    'const auth = require("./auth");',
    'function validate(token) {',
    '  return jwt.verify(token, secret);',
    '}',
    'middleware/auth.py:34–52',
    'config.py:18',
  ];
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.8 }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          color: i === active ? 'var(--bio-bright)' : 'var(--w4)',
          background: i === active ? 'rgba(45,212,191,0.08)' : 'transparent',
          padding: '1px 6px', borderRadius: 3,
          borderLeft: i === active ? '2px solid var(--bio-bright)' : '2px solid transparent',
          transition: 'all .3s ease',
        }}>{l}</div>
      ))}
    </div>
  );
}

function MiniVectorDots() {
  const dots = Array.from({ length: 20 }, (_, i) => ({
    x: 10 + (i % 5) * 18, y: 5 + Math.floor(i / 5) * 16,
    delay: i * 60, cluster: i < 14,
  }));
  return (
    <div style={{ position: 'relative', height: 65 }}>
      {dots.map((d, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: d.cluster ? `${50 + (i % 5) * 8}%` : `${d.x}%`,
          top: d.cluster ? `${20 + Math.floor(i / 5) * 12}%` : `${d.y}%`,
          width: 5, height: 5, borderRadius: '50%',
          background: d.cluster ? 'var(--bio-bright)' : 'var(--amber-glow)',
          boxShadow: `0 0 6px ${d.cluster ? 'var(--bio-teal)' : 'var(--amber-deep)'}`,
          transition: `all 1.5s ${d.delay}ms ease-in-out`,
          animation: 'orb-pulse 2s ease-in-out infinite',
          animationDelay: `${d.delay}ms`,
        }} />
      ))}
    </div>
  );
}

/* ─── Conveyor belt ─────────────────────────────────────── */
function ConveyorBelt() {
  const [active, setActive] = useState(0);
  const steps = [
    { n: '01', t: 'Paste a GitHub URL',    d: 'Drop any public GitHub repo URL. GitMind clones and scans the entire codebase automatically — no setup required.' },
    { n: '02', t: 'We index everything',   d: 'GitMind chunks the source files, generates semantic embeddings with Groq-speed inference, and stores them locally in ChromaDB.' },
    { n: '03', t: 'Ask in plain English',  d: 'Ask any question. GitMind retrieves the most relevant context and generates a precise, source-cited answer in seconds.' },
  ];
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % steps.length), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div className="l-conveyor">
        {steps.map((s, i) => (
          <div key={s.n} className={`l-conv-step ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
            <span className="l-step-n">{s.n}</span>
            <div className="l-step-title">{s.t}</div>
            <div className="l-step-desc">{s.d}</div>
            {i < steps.length - 1 && <div className="l-conv-beam" />}
          </div>
        ))}
      </div>
      <div className="l-conv-dots">
        {steps.map((_, i) => (
          <div key={i} className={`l-conv-dot ${i === active ? 'active' : ''}`} onClick={() => setActive(i)} />
        ))}
      </div>
    </div>
  );
}

/* ─── Footer wave SVG ───────────────────────────────────── */
function FooterWaves() {
  return (
    <svg className="l-footer-wave" viewBox="0 0 1440 40" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,20 C360,40 1080,0 1440,20 L1440,0 L0,0 Z" fill="rgba(249,115,22,0.04)" />
      <path d="M0,25 C400,5  1000,35 1440,15 L1440,0 L0,0 Z" fill="rgba(249,115,22,0.06)" />
      <path d="M0,15 C480,35 960,5  1440,25 L1440,0 L0,0 Z" fill="rgba(249,115,22,0.03)" />
      <path d="M0,22 C300,8  1100,32 1440,18 L1440,0 L0,0 Z" fill="rgba(45,212,191,0.05)" />
      <path d="M0,18 C600,30 900,10  1440,22 L1440,0 L0,0 Z" fill="rgba(249,115,22,0.02)" />
    </svg>
  );
}

/* ─── Marquee items ─────────────────────────────────────── */
const MARQUEE_ITEMS = [
  { icon: '🦙', text: 'Llama 3.3 70B' },
  { icon: '⚡', text: 'Groq Inference' },
  { icon: '🧬', text: 'ChromaDB Vectors' },
  { icon: '🐍', text: 'FastAPI Backend' },
  { icon: '⚛️', text: 'React + Vite' },
  { icon: '🔒', text: 'Fully Local' },
  { icon: '💬', text: 'Source Citations' },
  { icon: '📊', text: 'Language Analysis' },
];

/* ═══════════════════════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  useReveal();
  const nav = useNavigate();
  const go  = useCallback(() => nav('/app'), [nav]);

  return (
    <div className="l-page">
      <CustomCursor />
      <ThreeBackground />

      {/* ── NAV ── */}
      <nav className="gm-nav">
        <a href="/" className="gm-logo">
          <div className="gm-logo-mark">⬡</div>
          <span><span className="logo-g">G</span>it<span className="logo-m">M</span>ind</span>
        </a>
        <div className="gm-nav-links">
          <a href="#features" className="gm-nav-link">Features</a>
          <a href="#how"      className="gm-nav-link">How it works</a>
          <a href="https://github.com/PathanWasim/GitMind" target="_blank" rel="noreferrer" className="gm-nav-link">GitHub</a>
        </div>
        <div className="gm-nav-right">
          <MagneticBtn className="gm-btn-primary" onClick={go}>
            <span>Launch App →</span>
          </MagneticBtn>
        </div>
      </nav>

      {/* ── HERO — asymmetric 55/45 ── */}
      <section className="l-hero">
        <div className="l-hero-inner">
          {/* Left: text */}
          <div className="l-hero-text">
            {/* Badges */}
            <div className="l-hero-badges">
              <div className="l-hero-badge">
                <div className="l-hero-badge-dot" />
                ⚡ 800 tokens/sec via Groq
              </div>
              <div className="l-hero-badge" style={{ animationDelay: '0.3s' }}>
                <div className="l-hero-badge-dot" style={{ background: 'var(--bio-bright)', boxShadow: '0 0 8px var(--bio-teal)' }} />
                🔒 100% Local Embeddings
              </div>
            </div>

            <h1 className="l-headline">
              <span className="l-headline-word">Any</span>{' '}
              <span className="l-headline-word">Codebase.</span>
              <br />
              <span className="l-headline-word">Instantly</span>{' '}
              <span className="l-headline-word amber-word">Understood.</span>
            </h1>

            <p className="l-sub" style={{ animation: 'fadeUp 0.8s var(--slow) 0.6s both' }}>
              Index any GitHub repo and interrogate it with natural language.
              Get precise answers — with exact file and line citations.
            </p>

            <div className="l-cta-row">
              <MagneticBtn className="l-btn-cta" onClick={go}>
                <span>Launch App →</span>
              </MagneticBtn>
              <a href="https://github.com/PathanWasim/GitMind" target="_blank" rel="noreferrer"
                style={{ fontSize: 14, color: 'var(--w3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--w1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--w3)'}
              >
                View on GitHub ↗
              </a>
            </div>
          </div>

          {/* Right: Product preview through die-cut */}
          <div className="l-hero-canvas">
            <div className="l-preview-outer" style={{ animation: 'none', marginTop: 20 }}>
              <div className="l-preview-card">
                <div className="l-preview-titlebar">
                  <div className="l-dots">
                    <div className="l-dot" style={{ background:'#FF5F57' }} />
                    <div className="l-dot" style={{ background:'#FEBC2E' }} />
                    <div className="l-dot" style={{ background:'#28C840' }} />
                  </div>
                  <div className="l-addr"><span>⬡ gitmind.local / app</span></div>
                </div>
                <div className="l-preview-ui">
                  <div className="l-preview-left">
                    <div className="l-plabel">Repositories</div>
                    {[
                      { name: 'react',   meta: '147 files', color: 'var(--bio-bright)', on: true },
                      { name: 'next.js', meta: '203 files', color: 'var(--amber-glow)' },
                      { name: 'fastapi', meta: '64 files',  color: 'var(--plasma-gold)' },
                    ].map(r => (
                      <div key={r.name} className={`l-prepo ${r.on ? 'active' : ''}`}>
                        <div className="l-prepo-dot" style={{ background: r.color, boxShadow: r.on ? `0 0 8px ${r.color}` : 'none' }} />
                        <div><div>{r.name}</div><div className="l-prepo-meta">{r.meta}</div></div>
                      </div>
                    ))}
                  </div>
                  <div className="l-preview-chat">
                    <div className="l-pmsg user">How does the auth middleware work?</div>
                    <div className="l-pmsg ai">
                      Checks JWT tokens in the Authorization header, validates against the secret in config.py.
                      <div className="l-pcites">
                        <span className="l-pcite">middleware/auth.py:34–52</span>
                        <span className="l-pcite">config.py:18</span>
                      </div>
                    </div>
                    <div className="l-ptyping">
                      <div className="l-ptyping-icon">⬡</div>
                      <div className="l-typing-dots"><span /><span /><span /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="l-marquee-wrap">
        <div className="l-marquee-inner">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <div key={i} className="l-marquee-item">
              <span>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS — light treatment, amber→teal gradient ── */}
      <div className="l-stats">
        <div className="l-stats-inner">
          {[
            { num: 5,   suf: ' min', pre: '< ', label: 'To index a 1,000-file repo' },
            { num: 70,  suf: 'B',    pre: '',   label: 'Parameter model, via Groq' },
            { num: 100, suf: '%',    pre: '',   label: 'Local — your code stays private' },
            { num: '∞', suf: '',     pre: '',   label: 'Repositories you can index' },
          ].map(({ num, suf, pre, label }) => (
            <div key={label} className="l-stat reveal">
              <span className="l-stat-num">
                {num === '∞' ? '∞' : <CountUp target={num} prefix={pre} suffix={suf} />}
              </span>
              <div className="l-stat-label">{label}</div>
              <svg className="l-stat-spark" viewBox="0 0 80 24" preserveAspectRatio="none">
                <polyline
                  points="0,20 10,14 20,18 30,8 40,12 50,4 60,10 70,6 80,2"
                  fill="none" stroke="rgba(8,6,15,0.3)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                />
                <polyline
                  points="0,20 10,14 20,18 30,8 40,12 50,4 60,10 70,6 80,2"
                  fill="none" stroke="rgba(8,6,15,0.6)" strokeWidth="1"
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="120" strokeDashoffset="120"
                  style={{ animation: 'draw-line 2s ease forwards .5s' }}
                />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES — asymmetric bento ── */}
      <section id="features" style={{ background: 'var(--void)', position: 'relative', zIndex: 10 }}>
        {/* Ambient glow blob */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="l-section">
          <div className="l-section-head reveal">
            <span className="l-section-tag">Features</span>
            <h2 className="l-section-title">
              Everything to<br /><span className="amber-text">master any codebase</span>
            </h2>
            <p className="l-section-sub">
              Stop reading thousands of lines. Ask GitMind and get precise,
              grounded answers with exact source locations.
            </p>
          </div>

          <div className="l-feat-grid">
            {/* BIG — spans 2 cols */}
            <Tilt className="l-feat l-feat-area-big reveal">
              <div className="l-feat-icon">📁</div>
              <div className="l-feat-name">Index Any Repo</div>
              <div className="l-feat-desc">
                Paste a GitHub URL and watch GitMind clone, scan and embed your entire codebase automatically.
              </div>
              <div className="l-feat-visual">
                <MiniTerminal />
              </div>
            </Tilt>

            {/* TALL — spans 2 rows */}
            <Tilt className="l-feat l-feat-area-tall reveal reveal-delay-1">
              <div className="l-feat-icon">📍</div>
              <div className="l-feat-name">Source Citations</div>
              <div className="l-feat-desc">
                Every answer links to the precise file and line range. No hallucinations — fully grounded.
              </div>
              <div className="l-feat-visual" style={{ minHeight: 140 }}>
                <MiniScannerBeam />
              </div>
            </Tilt>

            {/* WIDE — spans 2 rows left */}
            <Tilt className="l-feat l-feat-area-wide reveal">
              <div className="l-feat-icon">💬</div>
              <div className="l-feat-name">AI Code Q&A</div>
              <div className="l-feat-desc">
                Ask anything in plain English. Answers with deep context and exact source citations.
              </div>
              <div className="l-feat-visual">
                <div className="l-fmsg user">How does the auth middleware work?</div>
                <div className="l-fmsg ai">
                  Checks JWT tokens in the Authorization header…
                  <div className="l-fmsg-cites">
                    <span className="l-fmsg-cite">middleware/auth.py:34–52</span>
                    <span className="l-fmsg-cite">config.py:18</span>
                  </div>
                </div>
              </div>
            </Tilt>

            {/* MED */}
            <Tilt className="l-feat l-feat-area-med reveal reveal-delay-1">
              <div className="l-feat-icon">🔎</div>
              <div className="l-feat-name">Vector Search</div>
              <div className="l-feat-desc">Semantic similarity search across all your code.</div>
              <div className="l-feat-visual"><MiniVectorDots /></div>
            </Tilt>

            {/* SML */}
            <Tilt className="l-feat l-feat-area-sml reveal reveal-delay-2">
              <div className="l-feat-icon">⚡</div>
              <div className="l-feat-name">Streaming AI</div>
              <div className="l-feat-desc">Real-time via Groq's LPU — fastest AI inference on earth.</div>
            </Tilt>

            {/* SML2 */}
            <Tilt className="l-feat l-feat-area-sml2 reveal reveal-delay-3">
              <div className="l-feat-icon">🔒</div>
              <div className="l-feat-name">Fully Local & Private</div>
              <div className="l-feat-desc">ChromaDB on your machine. Your code never leaves your environment.</div>
            </Tilt>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="l-how" id="how">
        <div className="l-how-inner">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="l-section-tag">How it works</span>
            <h2 className="l-section-title" style={{ maxWidth: 540, margin: '0 auto' }}>
              From URL to answers<br />in <span className="amber-text">3 steps</span>
            </h2>
          </div>
          <div className="reveal">
            <ConveyorBelt />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="l-cta-section reveal">
        <div className="l-cta-glow" />
        <div className="l-cta-glow-2" />
        <h2 className="l-cta-title">
          Start understanding code<br />
          <span className="amber-text">at the speed of thought.</span>
        </h2>
        <p className="l-cta-sub">Free · Open source · No account needed · Your code stays local</p>
        <MagneticBtn className="l-btn-cta" onClick={go} style={{ margin: '0 auto' }}>
          <span>Launch GitMind →</span>
        </MagneticBtn>
      </div>

      {/* ── FOOTER ── */}
      <footer className="l-footer">
        <FooterWaves />
        <div className="l-footer-inner">
          {/* Col 1: logo + tagline */}
          <div>
            <a href="/" className="gm-logo" style={{ marginBottom: 12, display: 'inline-flex' }}>
              <div className="gm-logo-mark" style={{ width: 24, height: 24, fontSize: 12 }}>⬡</div>
              <span><span className="logo-g">G</span>it<span className="logo-m">M</span>ind</span>
            </a>
            <p style={{ fontSize: 13, color: 'var(--w3)', lineHeight: 1.7, maxWidth: 220, marginTop: 8 }}>
              AI-powered codebase intelligence. Ask anything, get source-cited answers.
            </p>
          </div>
          {/* Col 2: navigation */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--amber-glow)', marginBottom: 16 }}>Navigation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#features" className="l-footer-link">Features</a>
              <a href="#how"      className="l-footer-link">How it works</a>
              <button onClick={go} className="l-footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>Launch App</button>
            </div>
          </div>
          {/* Col 3: social */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--amber-glow)', marginBottom: 16 }}>Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="https://github.com/PathanWasim/GitMind" target="_blank" rel="noreferrer" className="l-footer-link">GitHub ↗</a>
            </div>
          </div>
        </div>
        <div className="l-footer-bottom">
          <span className="l-footer-copy">© 2025 GitMind — Open Source</span>
          <div className="l-footer-links">
            <a href="#features" className="l-footer-link">Features</a>
            <a href="#how"      className="l-footer-link">How it works</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
