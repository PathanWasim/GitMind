import { useState, useRef, useEffect } from 'react';

const LANG_COLORS = {
  py:'#3572A5',js:'#F1E05A',jsx:'#61DAFB',ts:'#2B7489',tsx:'#61DAFB',
  java:'#B07219',go:'#00ADD8',rs:'#DEA584',c:'#555',cpp:'#F34B7D',
  cs:'#178600',rb:'#CC342D',php:'#4F5D95',swift:'#FFAC45',kt:'#A97BFF',
  md:'#A0B4C0',json:'#8BC34A',yaml:'#CB171E',yml:'#CB171E',
  css:'#563D7C',scss:'#C6538C',html:'#E34C26',sh:'#89E051',sql:'#E38C00',
};
const gc = ext => LANG_COLORS[ext] || '#6366F1';

function fmt(n) { return Number(n).toLocaleString(); }
function fmtDate(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }).toUpperCase();
}

/* ─── Stat card with mouse tilt + slot counter ──────────── */
function StatCard({ value, label, small }) {
  const ref  = useRef(null);
  const [displayed, setDisplayed] = useState('0');
  const [started, setStarted] = useState(false);

  // Tilt on mouse move
  const onMove = e => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    ref.current.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
    ref.current.style.setProperty('--my', `${(y + 0.5) * 100}%`);
    ref.current.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg) translateZ(4px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  // Slot-machine count-up on intersection
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      setStarted(true);
      obs.disconnect();
      const raw = String(value).replace(/[^0-9.]/g, '');
      const num = parseFloat(raw);
      if (!num || isNaN(num)) { setDisplayed(value); return; }
      const dur = 1400, steps = 50;
      let step = 0;
      const t = setInterval(() => {
        step++;
        const ease = 1 - Math.pow(1 - step / steps, 3);
        const cur = num * ease;
        setDisplayed(Number.isInteger(num) ? Math.round(cur).toLocaleString() : cur.toFixed(1));
        if (step >= steps) { setDisplayed(value); clearInterval(t); }
      }, dur / steps);
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value, started]);

  return (
    <div
      ref={ref}
      className="app-stat-card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition:'transform .4s var(--ease), border-color .3s, box-shadow .3s' }}
    >
      <div className="app-stat-val" style={small ? { fontSize:16, letterSpacing:0, paddingTop:6 } : {}}>
        {displayed}
      </div>
      <div className="app-stat-lbl">{label}</div>
    </div>
  );
}

/* ─── 3D Language bar segments ──────────────────────────── */
function LangBar({ topLangs, total }) {
  const ref = useRef(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !animated) { setAnimated(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [animated]);

  return (
    <div ref={ref}>
      {/* 3D extruded bar */}
      <div style={{ display:'flex', height:12, borderRadius:6, overflow:'visible', gap:2, marginBottom:16, perspective:200, perspectiveOrigin:'50% 100%' }}>
        {topLangs.map(([ext, count], i) => {
          const w = (count / total) * 100;
          return (
            <div
              key={ext}
              title={`.${ext}: ${count}`}
              style={{
                width:`${w}%`, height:'100%',
                background:gc(ext),
                borderRadius:3,
                transition:`transform .8s ${i * 0.08}s var(--slow), opacity .8s ${i * 0.08}s`,
                transform: animated
                  ? 'perspective(200px) translateZ(0) scaleY(1)'
                  : 'perspective(200px) translateZ(-20px) scaleY(0.1)',
                opacity: animated ? 1 : 0,
                transformOrigin:'bottom center',
                boxShadow:`0 2px 0 0 ${gc(ext)}88, 0 0 8px ${gc(ext)}44`,
                cursor:'default',
              }}
            />
          );
        })}
      </div>

      <div className="app-lang-rows">
        {topLangs.map(([ext, count], i) => (
          <div key={ext} className="app-lang-row" style={{ opacity: animated ? 1 : 0, transform: animated ? 'none' : 'translateX(-8px)', transition:`opacity .5s ${i*0.06}s, transform .5s ${i*0.06}s var(--ease)` }}>
            <div className="app-lang-dot" style={{ background:gc(ext), boxShadow:`0 0 6px ${gc(ext)}66` }} />
            <span className="app-lang-name">.{ext}</span>
            <span className="app-lang-count">{count}</span>
            <span className="app-lang-pct">{Math.round((count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Folder group ──────────────────────────────────────── */
function FolderGroup({ name, files }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="app-folder-hdr" onClick={() => setOpen(!open)}>
        <span className="app-folder-arrow">{open ? '▾' : '▸'}</span>
        <span className="app-folder-name" style={{ color: name === '(root)' ? 'var(--w3)' : 'var(--indigo-3)' }}>{name}</span>
        <span className="app-folder-badge">{files.length}</span>
      </div>
      {open && (
        <div className="app-folder-files">
          {files.slice(0, 35).map(f => {
            const fn  = f.split('/').pop();
            const ext = fn.includes('.') ? fn.split('.').pop().toLowerCase() : '';
            return (
              <div key={f} className="app-file-row">
                <div className="app-file-dot" style={{ background:gc(ext), boxShadow:`0 0 4px ${gc(ext)}55` }} />
                <span className="app-file-name" title={f}>{fn}</span>
              </div>
            );
          })}
          {files.length > 35 && (
            <div className="app-more-files">... {files.length - 35} more</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Typewriter README ─────────────────────────────────── */
function TypewriterReadme({ text }) {
  const [shown, setShown] = useState('');
  const [done,  setDone]  = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done) return;
      obs.disconnect();
      let i = 0;
      const speed = text.length > 400 ? 4 : 20;
      const t = setInterval(() => {
        i += speed;
        setShown(text.slice(0, i));
        if (i >= text.length) { setShown(text); setDone(true); clearInterval(t); }
      }, 20);
    }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [text, done]);

  return (
    <pre ref={ref} className="app-readme">
      {shown}
      {!done && <span style={{ display:'inline-block', width:6, height:12, background:'var(--indigo-2)', verticalAlign:'middle', animation:'blink .7s step-end infinite' }} />}
    </pre>
  );
}

/* ─── Main component ────────────────────────────────────── */
export default function RepoOverview({ repo }) {
  const stats    = repo.language_stats ?? {};
  const total    = Object.values(stats).reduce((a, b) => a + b, 0) || 1;
  const topLangs = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const groups = {};
  for (const f of (repo.file_tree ?? [])) {
    const key = f.split('/').length > 1 ? f.split('/')[0] : '(root)';
    (groups[key] = groups[key] || []).push(f);
  }
  const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="app-overview">
      {/* Stats */}
      <div className="app-stats-row">
        <StatCard value={fmt(repo.indexed_files)} label="Files Indexed" />
        <StatCard value={fmt(repo.chunks)} label="Code Chunks" />
        <StatCard value={Object.keys(stats).length} label="Languages" />
        <StatCard value={fmtDate(repo.indexed_at)} label="Last Indexed" small />
      </div>

      {/* Language distribution */}
      {topLangs.length > 0 && (
        <div className="app-panel">
          <div className="app-panel-label">Language Distribution</div>
          <LangBar topLangs={topLangs} total={total} />
        </div>
      )}

      {/* File structure */}
      {sortedGroups.length > 0 && (
        <div className="app-panel">
          <div className="app-panel-label">File Structure</div>
          <div className="app-file-tree">
            {sortedGroups.map(([dir, files]) => (
              <FolderGroup key={dir} name={dir} files={files} />
            ))}
          </div>
        </div>
      )}

      {/* README */}
      {repo.readme_excerpt && (
        <div className="app-panel">
          <div className="app-panel-label">README</div>
          <TypewriterReadme text={repo.readme_excerpt} />
        </div>
      )}
    </div>
  );
}
