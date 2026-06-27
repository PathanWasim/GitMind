import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ThreeBackground from '../components/ThreeBackground';
import '../index.css';

/* ════════════════════════════════════════════════════════════
   GITMIND — cinematic scroll story. The page is the narrative:
   scrolling = the indexing pipeline happening. A fixed 3D scene
   sits behind; HTML acts scroll over it. GSAP (CDN) drives smooth
   scroll, pins, SplitText and scrubbed reveals. Everything is
   guarded — without GSAP the full content still renders statically.
════════════════════════════════════════════════════════════ */

const TERM_LINES = [
  { p: '$ ', d: 'git clone --depth 1 https://github.com/user/repo' },
  { d: "Cloning into 'repo'..." },
  { d: 'remote: Enumerating objects: 847' },
  { d: 'remote: Counting objects: 100% (847/847)' },
  { ok: '✓ Cloned in 4.2s — 847 files indexed' },
];

const ANSWER_TEXT =
  'The auth middleware lives in middleware/auth.py. It intercepts every request, ' +
  'extracts the JWT from the Authorization header, and validates it against the ' +
  "secret in config.py using PyJWT's decode() method. If validation fails, it " +
  'returns HTTP 401 immediately.';

/* ── Embed act: self-contained vector scatter that clusters on enter
   (IntersectionObserver, no GSAP dependency). ── */
function VectorField() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [clustered, setClustered] = useState(false);

  const CLUSTERS = [
    { x: 0.22, y: 0.30, label: 'authentication' },
    { x: 0.50, y: 0.22, label: 'indexing' },
    { x: 0.78, y: 0.34, label: 'vector store' },
    { x: 0.30, y: 0.70, label: 'api routes' },
    { x: 0.62, y: 0.72, label: 'ui components' },
    { x: 0.85, y: 0.66, label: 'config' },
  ];

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setClustered(true); obs.disconnect(); }
    }, { threshold: 0.35 });
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    let raf;

    const dots = Array.from({ length: 300 }, (_, i) => {
      const c = CLUSTERS[i % CLUSTERS.length];
      return {
        sx: Math.random(), sy: Math.random(),
        tx: c.x + (Math.random() - 0.5) * 0.14,
        ty: c.y + (Math.random() - 0.5) * 0.14,
        delay: Math.random(), teal: i % 3 === 0,
      };
    });

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const start = { v: 0 };
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (clustered) start.v = Math.min(1, start.v + 0.012);
      const g = start.v;
      for (const d of dots) {
        const k = reduce ? (clustered ? 1 : 0) : Math.max(0, Math.min(1, (g - d.delay * 0.5) / 0.5));
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const x = (d.sx + (d.tx - d.sx) * e) * W;
        const y = (d.sy + (d.ty - d.sy) * e) * H;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = d.teal ? 'rgba(45,212,191,0.8)' : 'rgba(249,115,22,0.8)';
        ctx.shadowBlur = 6; ctx.shadowColor = ctx.fillStyle;
        ctx.fill(); ctx.shadowBlur = 0;
      }
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [clustered]);

  return (
    <div className="s-vec-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="s-vec-canvas" />
      {CLUSTERS.map((c) => (
        <div key={c.label} className={`s-vec-pill ${clustered ? 'show' : ''}`}
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}>
          {c.label}
        </div>
      ))}
    </div>
  );
}

/* ── Magnetic button (GSAP if present, else plain hover) ── */
function MagneticBtn({ children, className, onClick, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current, gsap = window.gsap;
    if (!el || !gsap || window.matchMedia('(hover: none)').matches) return;
    let inside = false;
    const move = (e) => {
      if (!inside) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < 80) gsap.to(el, { x: dx * 0.3, y: dy * 0.3, duration: 0.4 });
    };
    const enter = () => (inside = true);
    const leave = () => { inside = false; gsap.to(el, { x: 0, y: 0, duration: 0.4, ease: 'elastic.out(1,0.5)' }); };
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    document.addEventListener('mousemove', move);
    return () => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
      document.removeEventListener('mousemove', move);
    };
  }, []);
  return <button ref={ref} className={className} onClick={onClick} style={style}>{children}</button>;
}

export default function LandingPage() {
  const nav = useNavigate();
  const go = useCallback(() => nav('/app'), [nav]);

  const root = useRef(null);
  const navRef = useRef(null);

  /* ── GSAP scroll story ── */
  useLayoutEffect(() => {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const ScrollSmoother = window.ScrollSmoother;
    const SplitText = window.SplitText;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.innerWidth < 768;

    // Nav background toggle (works with or without GSAP)
    const onScroll = () => {
      if (navRef.current) navRef.current.classList.toggle('scrolled', window.scrollY > 80);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (!gsap || reduce) {
      return () => window.removeEventListener('scroll', onScroll);
    }

    let smoother;
    const ctx = gsap.context((self) => {
      const q = self.selector;

      // Smooth scroll (desktop only — never on mobile)
      if (ScrollSmoother && !mobile) {
        smoother = ScrollSmoother.create({
          wrapper: '#smooth-wrapper', content: '#smooth-content',
          smooth: 1.4, effects: true, normalizeScroll: true,
        });
      }

      /* ── Hero load timeline ── */
      const l1 = q('.s-line-1')[0], l2 = q('.s-line-2')[0], l3 = q('.s-line-3')[0];
      let charTargets = [l1, l2];
      if (SplitText) {
        const split = new SplitText([l1, l2], { type: 'chars' });
        charTargets = split.chars;
      }
      gsap.set(charTargets, { opacity: 0, y: 60, rotateX: -40, filter: 'blur(8px)' });
      gsap.set(l3, { opacity: 0, y: 60, filter: 'blur(8px)' });
      gsap.set(q('.s-badge'), { opacity: 0, y: -16 });
      gsap.set(q('.s-sub'), { opacity: 0, filter: 'blur(16px)' });
      gsap.set(q('.s-cta-row'), { opacity: 0, scale: 0.9 });

      const tl = gsap.timeline();
      tl.to(q('.s-badge'), { opacity: 1, y: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out' }, 0.1)
        .to(charTargets, { opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)', stagger: 0.025, duration: 0.8, ease: 'power3.out' }, 0.2)
        .to(l3, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out' }, 1.0)
        .to(q('.s-sub'), { opacity: 1, filter: 'blur(0px)', duration: 0.8 }, 1.4)
        .to(q('.s-cta-row'), { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.6)' }, 1.6);

      // Scroll indicator fades out
      gsap.to(q('.s-scroll-ind'), {
        opacity: 0, scrollTrigger: { trigger: root.current, start: 'top top-=50', end: 'top top-=120', scrub: true },
      });

      if (mobile) return; // skip pins on mobile; sections just scroll

      /* ── Act 2: Clone terminal (pinned, scrubbed typing) ── */
      const termLines = q('.s-term-line');
      gsap.set(termLines, { opacity: 0.12 });
      ScrollTrigger.create({
        trigger: q('.s-act-clone')[0], start: 'top top', end: '+=120%', pin: true, scrub: true,
        onUpdate: (s) => {
          const shown = s.progress * (termLines.length + 0.5);
          termLines.forEach((el, i) => { el.style.opacity = i < shown ? '1' : '0.12'; });
        },
      });
      gsap.from(q('.s-act-clone .s-act-title'), {
        scrollTrigger: { trigger: q('.s-act-clone')[0], start: 'top 70%' },
        y: 30, opacity: 0, duration: 0.7,
      });

      /* ── Act 3: Scan tree (pinned, edges draw) ── */
      const edges = q('.s-tree .edge');
      edges.forEach((e) => { const len = e.getTotalLength?.() || 100; e.style.strokeDasharray = len; e.style.strokeDashoffset = len; });
      const nodes = q('.s-tree .node');
      gsap.set(nodes, { opacity: 0, scale: 0, transformOrigin: 'center' });
      const counters = q('.s-count');
      ScrollTrigger.create({
        trigger: q('.s-act-scan')[0], start: 'top top', end: '+=130%', pin: true, scrub: true,
        onUpdate: (s) => {
          const p = s.progress;
          edges.forEach((e, i) => {
            const len = e.getTotalLength?.() || 100;
            const local = Math.max(0, Math.min(1, (p - (i / edges.length) * 0.6) / 0.4));
            e.style.strokeDashoffset = String(len * (1 - local));
          });
          nodes.forEach((n, i) => {
            const local = Math.max(0, Math.min(1, (p - (i / nodes.length) * 0.7) / 0.3));
            n.style.opacity = String(local); n.style.transform = `scale(${local})`;
          });
          counters.forEach((c) => {
            const to = parseFloat(c.dataset.to);
            const dec = c.dataset.dec === '1';
            const v = to * Math.min(1, p / 0.8);
            c.textContent = (c.dataset.prefix || '') + (dec ? v.toFixed(1) : Math.round(v)) + (c.dataset.suffix || '');
          });
        },
      });

      /* ── Act 5: Answer chat demo (pinned, scrubbed conversation) ── */
      const userMsg = q('.s-cd-user')[0];
      const userFull = userMsg ? userMsg.textContent : '';
      const think = q('.s-cd-think')[0];
      const words = q('.s-cd-word');
      const cites = q('.s-cd-cites')[0];
      gsap.set(words, { opacity: 0.08, filter: 'blur(4px)' });
      if (think) think.style.opacity = '0';
      if (cites) gsap.set(cites, { opacity: 0, y: 12 });

      ScrollTrigger.create({
        trigger: q('.s-answer')[0], start: 'top top', end: '+=160%', pin: true, scrub: true,
        onUpdate: (s) => {
          const p = s.progress;
          // 0–0.25 user types
          if (userMsg) {
            const n = Math.floor(Math.min(1, p / 0.25) * userFull.length);
            userMsg.textContent = userFull.slice(0, n);
          }
          // 0.25–0.5 thinking
          if (think) think.style.opacity = p > 0.25 && p < 0.52 ? '1' : '0';
          // 0.5–0.9 answer words
          const wn = Math.floor(Math.max(0, (p - 0.5) / 0.4) * words.length);
          words.forEach((w, i) => {
            const on = i < wn;
            w.style.opacity = on ? '1' : '0.08';
            w.style.filter = on ? 'blur(0px)' : 'blur(4px)';
          });
          // 0.9–1 citations
          if (cites) { const c = Math.max(0, Math.min(1, (p - 0.9) / 0.1)); cites.style.opacity = String(c); cites.style.transform = `translateY(${12 * (1 - c)}px)`; }
        },
      });

      /* ── Act 6: Bento cards reveal ── */
      gsap.from(q('.s-bcard'), {
        scrollTrigger: { trigger: q('.s-bento')[0], start: 'top 75%' },
        y: 40, opacity: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out',
      });

      /* ── Act 7: CTA kinetic words ── */
      const ctaWords = q('.s-cta-word');
      ctaWords.forEach((w, i) => {
        gsap.from(w, {
          scrollTrigger: { trigger: q('.s-cta-sec')[0], start: 'top 70%' },
          x: i % 2 === 0 ? -80 : 80, opacity: 0, duration: 0.7, delay: i * 0.12, ease: 'power3.out',
        });
      });

      ScrollTrigger.refresh();
    }, root);

    return () => {
      window.removeEventListener('scroll', onScroll);
      smoother?.kill();
      ctx.revert();
    };
  }, []);

  /* 3D tilt for bento cards */
  const tilt = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
  };
  const untilt = (e) => { e.currentTarget.style.transform = ''; };

  return (
    <div className="l-page" ref={root}>
      {/* Fixed 3D scene + nav: OUTSIDE #smooth-wrapper so never transformed */}
      <ThreeBackground />

      <nav className="s-nav" ref={navRef}>
        <a href="/" className="s-logo">
          <div className="s-logo-mark">⬡</div>
          <span><span className="logo-g">G</span>it<span className="logo-m">M</span>ind</span>
        </a>
        <div className="s-nav-links">
          <a href="#features" className="s-nav-link">Features</a>
          <a href="#how" className="s-nav-link">How it works</a>
          <a href="https://github.com/PathanWasim/GitMind" target="_blank" rel="noreferrer" className="s-nav-link">GitHub</a>
        </div>
        <MagneticBtn className="s-nav-cta" onClick={go}>Launch App →</MagneticBtn>
      </nav>

      <div id="smooth-wrapper">
        <div id="smooth-content">

          {/* ── ACT 1: HERO ── */}
          <section className="s-hero">
            <div className="s-hero-grid">
              <div className="s-hero-left">
                <div className="s-badges">
                  <div className="s-badge"><span className="s-badge-dot" />⚡ 800 tokens/sec via Groq</div>
                  <div className="s-badge"><span className="s-badge-dot" />🔒 100% Local Embeddings</div>
                </div>
                <h1 className="s-headline">
                  <span className="s-line s-line-1">Any Codebase.</span>
                  <span className="s-line s-line-2">Instantly</span>
                  <span className="s-line s-line-3 s-amber">Understood.</span>
                </h1>
                <p className="s-sub">
                  Index any public repo and interrogate it in plain English —
                  with precise, source-cited answers.
                </p>
                <div className="s-cta-row">
                  <MagneticBtn className="s-cta" onClick={go}><span>Launch App →</span></MagneticBtn>
                  <a className="s-ghost" href="https://github.com/PathanWasim/GitMind" target="_blank" rel="noreferrer">View on GitHub ↗</a>
                </div>
              </div>
              <div className="s-hero-right" data-cursor="crosshair">
                <div className="s-hero-right-inner">⬡ codebase universe</div>
              </div>
            </div>
            <div className="s-scroll-ind"><span>scroll</span><div className="s-chev" /></div>
          </section>

          {/* ── ACT 2: CLONE ── */}
          <section className="s-act s-act-clone">
            <div className="s-act-inner">
              <div>
                <div className="s-act-label">01 / Clone</div>
                <h2 className="s-act-title">Any public<br />GitHub repo.</h2>
                <p className="s-act-body">
                  Paste a URL. GitMind shallow-clones it in seconds — only the
                  latest commit, no history bloat.
                </p>
              </div>
              <div className="s-term">
                <div className="s-term-bar">
                  <div className="s-term-dots">
                    <i style={{ background: '#FF5F57' }} /><i style={{ background: '#FEBC2E' }} /><i style={{ background: '#28C840' }} />
                  </div>
                  <span className="s-term-label">bash</span>
                </div>
                <div className="s-term-body">
                  {TERM_LINES.map((l, i) => (
                    <div className="s-term-line" key={i}>
                      {l.p && <span className="p">{l.p}</span>}
                      {l.ok ? <span className="ok">{l.ok}</span> : <span className="d">{l.d}</span>}
                    </div>
                  ))}
                  <span className="s-term-caret" />
                </div>
              </div>
            </div>
          </section>

          {/* ── ACT 3: SCAN ── */}
          <section className="s-act s-act-scan">
            <div className="s-act-inner">
              <div className="s-tree-wrap">
                <svg className="s-tree" viewBox="0 0 320 260">
                  {/* edges */}
                  <path className="edge" d="M40,30 L40,80" /><path className="edge" d="M40,80 L90,80" />
                  <path className="edge" d="M40,80 L40,130" /><path className="edge" d="M40,130 L90,130" />
                  <path className="edge" d="M40,130 L40,180" /><path className="edge" d="M40,180 L90,180" />
                  <path className="edge" d="M90,80 L150,80" /><path className="edge" d="M90,130 L150,130" />
                  <path className="edge" d="M90,180 L150,180" /><path className="edge" d="M40,180 L40,230" />
                  <path className="edge" d="M40,230 L90,230" />
                  {/* nodes */}
                  {[
                    [30, 22, '#F97316', 'src/'], [80, 72, '#2DD4BF', 'api.js'], [80, 122, '#F97316', 'app.py'],
                    [80, 172, '#0D9488', 'auth.ts'], [80, 222, '#EAB308', 'main.go'],
                    [140, 72, '#2DD4BF', ''], [140, 122, '#F97316', ''], [140, 172, '#0D9488', ''],
                  ].map(([x, y, c, label], i) => (
                    <g className="node" key={i}>
                      <rect x={x} y={y} width="16" height="16" rx="3" fill={c} />
                      {label && <text className="node-label" x={x + 22} y={y + 12}>{label}</text>}
                    </g>
                  ))}
                </svg>
              </div>
              <div>
                <div className="s-act-label">02 / Scan</div>
                <h2 className="s-act-title">Every file.<br />Every line.</h2>
                <p className="s-act-body">
                  30+ source extensions. Binary detection. Vendor dirs skipped.
                  Clean signal only.
                </p>
                <div className="s-act-stats">
                  <div>
                    <div className="s-act-stat-num"><span className="s-count" data-to="30" data-suffix="+">0</span></div>
                    <div className="s-act-stat-lbl">Extensions</div>
                  </div>
                  <div>
                    <div className="s-act-stat-num"><span className="s-count" data-to="350" data-suffix="KB">0</span></div>
                    <div className="s-act-stat-lbl">Size cap</div>
                  </div>
                  <div>
                    <div className="s-act-stat-num">&lt;<span className="s-count" data-to="1" data-suffix="s">0</span></div>
                    <div className="s-act-stat-lbl">Scan time</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── ACT 4: EMBED ── */}
          <section className="s-act surface" id="features">
            <div className="s-act-inner">
              <VectorField />
              <div>
                <div className="s-act-label">03 / Embed</div>
                <h2 className="s-act-title">384 dimensions<br />of understanding.</h2>
                <p className="s-act-body">
                  Local sentence-transformers model. Zero external API calls during
                  indexing. Your code never leaves your machine.
                </p>
                <div className="s-feat-line"><span className="ck">✓</span> all-MiniLM-L6-v2 · 384 dims · CPU</div>
                <div className="s-feat-line"><span className="ck">✓</span> ChromaDB HNSW index · &lt;50ms query</div>
                <div className="s-feat-line"><span className="ck">✓</span> One collection per repository</div>
              </div>
            </div>
          </section>

          {/* ── ACT 5: ANSWER (the centrepiece) ── */}
          <section className="s-answer" id="how">
            <div className="s-answer-glow" />
            <div className="s-cd">
              <div className="s-cd-head"><span className="dot" /><span className="t">gitmind · chat</span></div>
              <div className="s-cd-msg user"><span className="s-cd-user">How does the authentication middleware work?</span></div>
              <div className="s-cd-think"><span>GitMind is analyzing 12 relevant chunks</span><span className="dots"><i /><i /><i /></span></div>
              <div className="s-cd-msg ai">
                {ANSWER_TEXT.split(' ').map((w, i) => (
                  <span className="s-cd-word" key={i}>{w}{' '}</span>
                ))}
                <div className="s-cd-cites">
                  <span className="s-cd-cite">middleware/auth.py:34–52</span>
                  <span className="s-cd-cite">config.py:18</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── ACT 6: FEATURES BENTO ── */}
          <section className="s-bento-sec">
            <div className="s-bento">
              <div className="s-bcard s-bcard-a" onMouseMove={tilt} onMouseLeave={untilt}>
                <div className="s-bcard-h">Lightning-fast indexing</div>
                <div className="s-bcard-p">Clone, scan, chunk, embed, store — five stages, streamed live.</div>
                <div className="s-bars"><div className="s-bar" /><div className="s-bar" /><div className="s-bar" /><div className="s-bar" /><div className="s-bar" /></div>
              </div>
              <div className="s-bcard s-bcard-b" onMouseMove={tilt} onMouseLeave={untilt}>
                <div className="s-bcard-h">Local embeddings</div>
                <div className="s-bcard-p">Your code never leaves the machine.</div>
                <div className="s-mono">all-MiniLM-L6-v2 · 384 dims · ~80MB · CPU</div>
              </div>
              <div className="s-bcard s-bcard-c" onMouseMove={tilt} onMouseLeave={untilt}>
                <div className="s-bignum">800+</div>
                <div className="s-bcard-p" style={{ marginTop: 8 }}>tok/s via Groq LLaMA 3.3 70B</div>
              </div>
              <div className="s-bcard s-bcard-d" onMouseMove={tilt} onMouseLeave={untilt}>
                <div className="s-bcard-h" style={{ fontSize: 20 }}>Source citations</div>
                <div className="s-cite-stack">
                  <span className="s-cd-cite">auth.py:34–52</span>
                  <span className="s-cd-cite">config.py:18</span>
                </div>
              </div>
              <div className="s-bcard s-bcard-e surface" onMouseMove={tilt} onMouseLeave={untilt}>
                <div className="s-lock">🔒</div>
                <div className="s-bcard-h" style={{ fontSize: 20 }}>100% local</div>
                <div className="s-bcard-p">Embeddings never leave your machine.</div>
              </div>
            </div>
          </section>

          {/* ── ACT 7: CTA ── */}
          <section className="s-cta-sec">
            <div className="s-cta-amb l" /><div className="s-cta-amb r" />
            <h2 className="s-cta-title">
              <span className="s-cta-word">Ready to understand</span>
              <span className="s-cta-word">any codebase?</span>
            </h2>
            <p className="s-cta-sub">Free · open source · no account · your code stays local.</p>
            <div className="s-cta-cluster">
              <MagneticBtn className="s-cta" onClick={go}><span>Launch GitMind →</span></MagneticBtn>
              <a className="s-ghost" href="https://github.com/PathanWasim/GitMind" target="_blank" rel="noreferrer">View on GitHub ↗</a>
            </div>
          </section>

          {/* ── FOOTER ── */}
          <footer className="s-footer">
            <a href="/" className="s-logo" style={{ fontSize: 15 }}>
              <div className="s-logo-mark" style={{ width: 24, height: 24, fontSize: 12 }}>⬡</div>
              <span><span className="logo-g">G</span>it<span className="logo-m">M</span>ind</span>
            </a>
            <div className="s-foot-links">
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="https://github.com/PathanWasim/GitMind" target="_blank" rel="noreferrer">GitHub ↗</a>
              <button onClick={go}>Launch App</button>
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
}
