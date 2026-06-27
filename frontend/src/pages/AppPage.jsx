import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import IntroScreen from '../components/IntroScreen';
import ChatView from '../components/ChatView';
import RepoOverview from '../components/RepoOverview';
import { listRepositories, indexRepositoryWithProgress } from '../services/api';

const STAGE_LABELS = {
  cloning:   'CLONING REPOSITORY',
  scanning:  'SCANNING FILE TREE',
  chunking:  'CHUNKING SOURCE CODE',
  embedding: 'GENERATING EMBEDDINGS',
  saving:    'WRITING METADATA',
};

const STAGE_DESC = {
  cloning:   'Fetching repository from GitHub and initializing local workspace...',
  scanning:  'Traversing directory tree and cataloguing all source files...',
  chunking:  'Splitting source files into semantic chunks for embedding...',
  embedding: 'Generating vector embeddings with sentence transformers...',
  saving:    'Persisting metadata and finalizing the index...',
};

const LOG_LINES = {
  cloning:   ['→ git clone https://github.com/...', '→ Resolving repository structure', '→ Authentication verified'],
  scanning:  ['→ Scanning src/', '→ Found 147 .jsx files', '→ Found 23 .css files', '→ Cataloguing dependencies'],
  chunking:  ['→ Splitting files into 512-token chunks', '→ Preserving function boundaries', '→ Context-aware splitting active'],
  embedding: ['→ Loading sentence-transformers model', '→ Batching 2048 chunks', '→ Embedding batch 1/8...', '→ GPU acceleration active'],
  saving:    ['→ Writing to ChromaDB collection', '→ Persisting file metadata', '→ Building search index'],
};

/* ─── Mini EQ visualizer for the model chip ─────────────── */
function MiniEQ() {
  const heights = [10, 14, 7, 12, 8];
  return (
    <div className="mc-eq" title="Neural activity">
      {heights.map((h, i) => (
        <i key={i} style={{ height: h, '--h': `${h}px`, animation: `eq-anim ${0.6 + i * 0.1}s ease-in-out infinite`, animationDelay: `${i * 0.05}s` }} />
      ))}
    </div>
  );
}

/* ─── Full-screen indexing overlay ────────────────────────
   Stage-specific 2D canvas visualizations:
   cloning   → growing branch tree
   scanning  → file nodes appearing
   chunking  → file splitting effect
   embedding → dots flying to cluster
   saving    → grid solidifying
──────────────────────────────────────────────────────────── */
function StageViz({ stage, percent }) {
  const canvasRef = useRef(null);
  const stageRef  = useRef(stage);
  const pctRef    = useRef(percent);

  useEffect(() => { stageRef.current = stage; pctRef.current = percent; }, [stage, percent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let id;
    let dots   = [];
    let target = { x: canvas.width * 0.65, y: canvas.height * 0.5 };
    let nodes  = [];
    let t0 = performance.now();

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      target = { x: canvas.width * 0.65, y: canvas.height * 0.5 };
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize dots for embedding stage
    const initDots = () => {
      dots = Array.from({ length: 80 }, (_, i) => ({
        x: canvas.width * 0.1 + Math.random() * canvas.width * 0.3,
        y: canvas.height * 0.2 + Math.random() * canvas.height * 0.6,
        tx: target.x + (Math.random() - 0.5) * 120,
        ty: target.y + (Math.random() - 0.5) * 120,
        vx: 0, vy: 0,
        color: Math.random() > 0.4 ? '#F97316' : '#2DD4BF',
        size: 2 + Math.random() * 3,
        arrived: false,
        delay: i * 30,
      }));
    };
    initDots();

    // File nodes for scanning
    nodes = Array.from({ length: 40 }, (_, i) => ({
      x: 80 + (i % 8) * 60,
      y: 60 + Math.floor(i / 8) * 55,
      visible: false,
      showAt: i * 80,
    }));

    const draw = (now) => {
      id = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = now - t0;
      const st = stageRef.current;

      if (st === 'cloning' || st === null) {
        // Growing git branch tree
        ctx.strokeStyle = 'rgba(249,115,22,0.7)';
        ctx.lineWidth = 2;
        const cx = canvas.width / 2, cy = canvas.height * 0.85;
        const progress = Math.min(1, elapsed / 3000);
        const drawBranch = (x, y, len, angle, depth) => {
          if (depth === 0 || len < 8) return;
          const maxLen = len * progress;
          const ex = x + Math.cos(angle) * maxLen;
          const ey = y - Math.sin(angle) * maxLen;
          ctx.globalAlpha = 0.4 + depth * 0.15;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
          const node = depth === 4 || depth === 3;
          if (progress > 0.6 && node) {
            ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2);
            ctx.fillStyle = '#F97316'; ctx.globalAlpha = 0.8; ctx.fill();
          }
          if (progress > 0.4) drawBranch(ex, ey, len * 0.7, angle - 0.4, depth - 1);
          if (progress > 0.4) drawBranch(ex, ey, len * 0.65, angle + 0.5, depth - 1);
        };
        ctx.globalAlpha = 1;
        drawBranch(cx, cy, 120, Math.PI/2, 4);
        ctx.fillStyle = 'rgba(249,115,22,0.7)';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillText('main', cx + 8, cy - 130 * progress);

      } else if (st === 'scanning') {
        nodes.forEach((n, i) => {
          if (elapsed < n.showAt) return;
          ctx.globalAlpha = Math.min(1, (elapsed - n.showAt) / 300);
          const ext = ['jsx','js','py','ts','css','json','md'][i % 7];
          const colors = { jsx:'#2DD4BF',js:'#F97316',py:'#3572A5',ts:'#0D9488',css:'#EAB308',json:'#8BC34A',md:'#A0B4C0' };
          ctx.fillStyle = colors[ext] || '#818CF8';
          ctx.fillRect(n.x - 10, n.y - 8, 20, 16);
          ctx.fillStyle = '#1a1a30'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(`.${ext}`, n.x, n.y + 2);
          ctx.textAlign = 'left';
        });

      } else if (st === 'chunking') {
        const cols = 4, rows = 3;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const fi = r * cols + c;
            const fx = 60 + c * 100, fy = 60 + r * 80;
            const fProgress = Math.min(1, Math.max(0, (elapsed - fi * 200) / 600));
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = 'rgba(249,115,22,0.5)'; ctx.lineWidth = 1;
            ctx.strokeRect(fx, fy, 70, 55);
            if (fProgress > 0.3) {
              for (let ch = 1; ch <= 3; ch++) {
                const lineY = fy + ch * 13;
                const lineProgress = Math.min(1, (fProgress - 0.3) / 0.7);
                ctx.strokeStyle = `rgba(45,212,191,${lineProgress * 0.7})`;
                ctx.setLineDash([4, 4]);
                ctx.beginPath(); ctx.moveTo(fx, lineY); ctx.lineTo(fx + 70 * lineProgress, lineY); ctx.stroke();
                ctx.setLineDash([]);
              }
            }
          }
        }

      } else if (st === 'embedding') {
        dots.forEach(d => {
          if (elapsed < d.delay) return;
          const t = Math.min(1, (elapsed - d.delay) / 1800);
          const ease = t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
          const x = d.x + (d.tx - d.x) * ease;
          const y = d.y + (d.ty - d.y) * ease;
          d.arrived = t >= 0.98;
          ctx.globalAlpha = 0.3 + t * 0.7;
          ctx.beginPath(); ctx.arc(x, y, d.size * (0.5 + t * 0.5), 0, Math.PI*2);
          ctx.fillStyle = d.color;
          ctx.shadowBlur = 8; ctx.shadowColor = d.color;
          ctx.fill(); ctx.shadowBlur = 0;
          if (t > 0.1 && t < 0.95) {
            const bx = d.x + (d.tx - d.x) * ease * 0.8;
            const by = d.y + (d.ty - d.y) * ease * 0.8;
            ctx.globalAlpha = 0.15;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y);
            ctx.strokeStyle = d.color; ctx.lineWidth = 1; ctx.stroke();
          }
        });
        const arrived = dots.filter(d => d.arrived).length;
        if (arrived > 5) {
          ctx.globalAlpha = 0.15;
          const g = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, 80);
          g.addColorStop(0, '#0D9488'); g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(target.x, target.y, 80, 0, Math.PI*2); ctx.fill();
        }
        if (elapsed > 2500) { t0 = now - 500; initDots(); }

      } else if (st === 'saving' || st === 'complete') {
        const cols2 = 10, rows2 = 8;
        const cellW = (canvas.width - 40) / cols2;
        const cellH = (canvas.height - 40) / rows2;
        for (let r2 = 0; r2 < rows2; r2++) {
          for (let c2 = 0; c2 < cols2; c2++) {
            const cellIdx = r2 * cols2 + c2;
            const fillPct = pctRef.current / 100;
            const filled = cellIdx < Math.floor(cols2 * rows2 * fillPct);
            const cx2 = 20 + c2 * cellW + cellW/2;
            const cy2 = 20 + r2 * cellH + cellH/2;
            ctx.globalAlpha = filled ? 0.7 : 0.15;
            ctx.fillStyle = filled ? '#F97316' : '#110D1A';
            ctx.beginPath();
            const r3 = Math.min(cellW, cellH) * 0.35;
            if (ctx.roundRect) ctx.roundRect(cx2 - r3, cy2 - r3, r3*2, r3*2, 4);
            else ctx.rect(cx2 - r3, cy2 - r3, r3*2, r3*2);
            ctx.fill();
            if (filled) {
              ctx.globalAlpha = 0.3;
              ctx.strokeStyle = '#EAB308'; ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }

      ctx.globalAlpha = 1;
    };

    id = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="indexing-viz-canvas"
      style={{ display:'block', width:'100%', height:'100%' }}
    />
  );
}

/* ─── Full screen indexing overlay (clip-path takeover) ─── */
function IndexingOverlay({ stage, percent, logLines }) {
  const label = STAGE_LABELS[stage] ?? stage?.toUpperCase() ?? 'INITIALIZING';
  const desc  = STAGE_DESC[stage]  ?? 'Processing...';

  return (
    <div className="indexing-overlay indexing-overlay-expand">
      <div style={{ padding:'20px 40px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#C2410C,#F97316)', display:'grid', placeItems:'center', fontSize:14, boxShadow:'0 0 20px rgba(249,115,22,0.5)' }}>⬡</div>
        <div style={{ fontFamily:'var(--syne)', fontSize:15, fontWeight:700, color:'var(--w1)' }}>GitMind</div>
        <div style={{ flex:1 }} />
        <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--amber-glow)', letterSpacing:2, textTransform:'uppercase' }}>Indexing Engine</div>
      </div>

      <div className="indexing-overlay-inner">
        {/* Left — terminal logs */}
        <div className="indexing-terminal">
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--bio-bright)', letterSpacing:3, textTransform:'uppercase', marginBottom:8 }}>
            Stage {Object.keys(STAGE_LABELS).indexOf(stage) + 1} / {Object.keys(STAGE_LABELS).length}
          </div>
          <div className="indexing-stage-label grad-text">{label}</div>
          <div className="indexing-stage-sub">{desc}</div>

          <div className="indexing-log">
            {logLines.map((l, i) => {
              let cls = '';
              if (l.includes('GPU') || l.includes('active') || l.includes('Embedding') || l.includes('batch')) cls = 'hi';
              else if (l.includes('clone') || l.includes('git') || l.includes('Resolving') || l.includes('Authentication')) cls = 'amber';
              else if (l.includes('complete') || l.includes('READY') || l.includes('Persisting') || l.includes('index')) cls = 'gold';
              return (
                <div key={i} className={`indexing-log-line ${cls}`}>{l}</div>
              );
            })}
            <span style={{ display:'inline-block', width:7, height:12, background:'var(--amber-glow)', verticalAlign:'middle', animation:'blink .7s step-end infinite' }} />
          </div>
        </div>

        {/* Right — live visualization */}
        <div className="indexing-viz">
          <StageViz stage={stage} percent={percent} />
        </div>
      </div>

      {/* Progress beam at bottom */}
      <div className="indexing-progress-bar">
        <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--bio-bright)', letterSpacing:1, minWidth:140 }}>
          {label}
        </div>
        <div className="indexing-progress-track">
          <div className="indexing-progress-fill" style={{ width:`${percent}%` }} />
        </div>
        <div className="indexing-pct">{percent}%</div>
      </div>
    </div>
  );
}

/* ─── Index modal ───────────────────────────────────────── */
function IndexModal({ onClose, onIndexed }) {
  const [url,        setUrl]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [progress,   setProgress]   = useState(null);
  const [error,      setError]      = useState('');
  const [inputFocus, setInputFocus] = useState(false);
  const [logLines,   setLogLines]   = useState([]);

  const addLog = useCallback((stage) => {
    const lines = LOG_LINES[stage] ?? [];
    lines.forEach((l, i) => setTimeout(() => setLogLines(p => [...p.slice(-20), l]), i * 400));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true); setError(''); setLogLines([]);
    setProgress({ stage:'cloning', percent:2, message:'Initializing…' });
    addLog('cloning');

    await indexRepositoryWithProgress(url.trim(), {
      onProgress: d => {
        setProgress(d);
        if (d.stage && LOG_LINES[d.stage] && d.stage !== progress?.stage) addLog(d.stage);
      },
      onComplete: d  => { onIndexed(d); onClose(); },
      onError:    msg => { setError(msg); setProgress(null); setLoading(false); },
    });
  }

  // Show full-screen overlay while loading
  if (loading && progress) {
    return (
      <IndexingOverlay
        stage={progress.stage}
        percent={progress.percent}
        logLines={logLines}
      />
    );
  }

  return (
    <div className="app-modal-overlay" onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div className="app-modal">
        <div className="app-modal-tag">Initialize</div>
        <div className="app-modal-title">Index a Repository</div>
        <div className="app-modal-sub">
          Paste a public GitHub URL. GitMind clones, embeds and indexes the entire
          codebase so you can query it in natural language.
        </div>
        <form onSubmit={submit}>
          <div className="app-modal-input-wrap">
            <input
              className="app-modal-input" type="url"
              placeholder="https://github.com/org/repository"
              value={url} onChange={e => setUrl(e.target.value)}
              autoFocus disabled={loading}
              onFocus={() => setInputFocus(true)}
              onBlur={() => setInputFocus(false)}
            />
            <div className={`scan-border ${inputFocus ? 'active' : ''}`}>
              <div className="scan-beam" />
            </div>
          </div>
          {error && <div className="app-modal-error">{error}</div>}
          <div className="app-modal-actions">
            <button className="app-modal-btn" type="submit" disabled={loading || !url.trim()}>
              {loading
                ? <><div className="spinner" style={{ borderTopColor:'#fff', borderColor:'rgba(255,255,255,0.2)' }} />Launching…</>
                : '⬡ Start Indexing'
              }
            </button>
            {!loading && <button type="button" className="app-modal-cancel" onClick={onClose}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Welcome screen ─────────────────────────────────────── */
function Welcome({ onOpen }) {
  return (
    <div className="app-welcome">
      <div className="app-welcome-icon" style={{ fontSize:56 }}>⬡</div>
      <div className="app-welcome-title">Index a Repository</div>
      <div className="app-welcome-sub">
        Paste a GitHub URL to index your codebase. Then ask anything — architecture,
        logic, data flow — and get source-cited answers.
      </div>
      <button className="s-cta" onClick={onOpen} style={{ margin:'0 auto' }}>
        <span>Index a Repository →</span>
      </button>
    </div>
  );
}

/* ─── Repo view (tabs preserved via CSS display:none) ────── */
function RepoView({ repo }) {
  const [tab, setTab] = useState('overview');
  useEffect(() => { setTab('overview'); }, [repo.id]);

  return (
    <div className="app-repo-panel">
      <div className="app-repo-header">
        <div className="app-repo-name-row">
          <div className="app-repo-ident">Active Repository</div>
          <div className="app-repo-name">{repo.name}</div>
          <div className="app-repo-meta">
            {repo.indexed_files} files · {repo.chunks} chunks · {repo.url}
          </div>
        </div>
        <div className="app-status">
          <div className="app-status-dot" />
          Indexed
        </div>
      </div>

      <div className="app-tabs">
        <button className={`app-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`app-tab ${tab === 'chat'     ? 'active' : ''}`} onClick={() => setTab('chat')}>Chat</button>
      </div>

      <div style={{ display: tab === 'overview' ? 'flex' : 'none', flex:1, overflow:'hidden', flexDirection:'column' }}>
        <RepoOverview repo={repo} />
      </div>
      <div style={{ display: tab === 'chat' ? 'flex' : 'none', flex:1, overflow:'hidden', flexDirection:'column' }}>
        <ChatView repo={repo} />
      </div>
    </div>
  );
}

/* ─── Sidebar — repository rail ──────────────────────────── */
function Sidebar({ repos, activeRepo, onSelect, onIndex, onHome }) {
  return (
    <aside className="mc-sidebar">
      <div className="mc-brand" onClick={onHome}>
        <div className="mc-brand-mark">⬡</div>
        <span className="mc-brand-name">GitMind</span>
      </div>

      <div className="mc-side-head">Repositories</div>
      <div className="mc-repos">
        {repos.length === 0
          ? <div className="mc-repos-empty">No repositories yet. Index one to begin.</div>
          : repos.map((r, i) => (
              <div
                key={r.id}
                className={`mc-repo ${r.id === activeRepo?.id ? 'active' : ''}`}
                onClick={() => onSelect(r)}
                style={{ animation: `dropIn .3s var(--ease) ${i * 0.06}s both` }}
              >
                <div className="mc-repo-dot" />
                <div className="mc-repo-info">
                  <div className="mc-repo-name">{r.name}</div>
                  <div className="mc-repo-meta">{r.indexed_files} files</div>
                </div>
              </div>
            ))
        }
      </div>

      <button className="mc-index-btn" onClick={onIndex}>+ Index New Repo</button>
    </aside>
  );
}

/* ─── App page root ──────────────────────────────────────── */
export default function AppPage() {
  const navigate = useNavigate();
  const [showIntro,  setShowIntro]  = useState(true);
  const [repos,      setRepos]      = useState([]);
  const [activeRepo, setActiveRepo] = useState(null);
  const [showModal,  setShowModal]  = useState(false);

  useEffect(() => {
    listRepositories().then(d => {
      const list = d.repositories ?? [];
      setRepos(list);
      if (list.length > 0) setActiveRepo(list[0]);
    }).catch(() => {});
  }, []);

  function handleIndexed(data) {
    const r = {
      id:             data.repository_id,
      name:           data.name,
      url:            data.repo_url,
      status:         data.status,
      indexed_files:  data.indexed_files,
      chunks:         data.chunks,
      language_stats: data.language_stats  ?? {},
      file_tree:      data.file_tree       ?? [],
      readme_excerpt: data.readme_excerpt  ?? '',
      indexed_at:     data.indexed_at,
    };
    setRepos(p => {
      const ex = p.find(x => x.id === r.id);
      return ex ? p.map(x => x.id === r.id ? r : x) : [r, ...p];
    });
    setActiveRepo(r);
  }

  return (
    <div className="mc">
      {showIntro && <IntroScreen onComplete={() => setShowIntro(false)} />}

      <Sidebar
        repos={repos}
        activeRepo={activeRepo}
        onSelect={setActiveRepo}
        onIndex={() => setShowModal(true)}
        onHome={() => navigate('/')}
      />

      <div className="mc-main">
        {/* Topbar */}
        <div className="mc-topbar">
          <div className="mc-crumb">
            <span>GitMind</span>
            {activeRepo && <>
              <span className="sep">/</span>
              <span className="cur">{activeRepo.name}</span>
              <span className="sep">/</span>
              <span>Workspace</span>
            </>}
          </div>
          <div className="mc-model">
            <span className="mc-model-name">LLaMA 3.3 70B</span>
            <MiniEQ />
          </div>
        </div>

        {/* Body */}
        <div className="mc-body">
          <div className="mc-bg" />
          <div className="mc-content">
            {activeRepo
              ? <RepoView key={activeRepo.id} repo={activeRepo} />
              : <Welcome onOpen={() => setShowModal(true)} />
            }
          </div>
        </div>
      </div>

      {showModal && (
        <IndexModal
          onClose={() => setShowModal(false)}
          onIndexed={handleIndexed}
        />
      )}
    </div>
  );
}
