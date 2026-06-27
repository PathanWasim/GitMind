import { useState, useEffect } from 'react';

const BOOT = [
  { text: '> INITIALIZING BIOLUMINESCENT FORGE...',  color: 'var(--amber-glow)' },
  { text: '> LOADING SENTENCE TRANSFORMERS...',       color: 'var(--w2)' },
  { text: '> CONNECTING TO GROQ / LLAMA-3.3-70B...', color: 'var(--bio-bright)' },
  { text: '> VECTOR DATABASE ONLINE...',              color: 'var(--bio-bright)' },
  { text: '> SYSTEM READY.',                          color: 'var(--plasma-gold)' },
];

export default function IntroScreen({ onComplete }) {
  const [phase, setPhase] = useState('idle');
  const [lines, setLines] = useState([]);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const T = [];
    const add = (fn, ms) => T.push(setTimeout(fn, ms));

    add(() => setPhase('logo'), 200);
    add(() => setPhase('log'), 900);
    BOOT.forEach((l, i) => add(() => setLines(p => [...p, l]), 1100 + i * 380));
    add(() => setPhase('done'), 1100 + BOOT.length * 380 + 400);
    add(() => setFading(true), 1100 + BOOT.length * 380 + 1000);
    add(() => onComplete(), 1100 + BOOT.length * 380 + 1600);

    return () => T.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className={`intro-screen ${fading ? 'intro-fade' : ''}`}>
      <div className="intro-grid" />
      <div className="intro-scan" />

      <div className="intro-inner">
        <div className={`intro-logo-block ${phase !== 'idle' ? 'show' : ''}`}>
          {/* Animated amber-teal glyph */}
          <div className="intro-glyph" style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{
              background: 'linear-gradient(135deg, var(--amber-glow) 30%, var(--bio-bright) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              fontSize: 48, lineHeight: 1,
            }}>⬡</span>
            <span style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>G</span>
          </div>
          <div className="intro-wordmark">
            <span style={{ color: 'var(--amber-glow)' }}>G</span>it
            <span style={{ color: 'var(--amber-glow)' }}>M</span>ind
            <span style={{ color: 'var(--bio-bright)', marginLeft: 6, fontSize: '0.6em', verticalAlign: 'super', letterSpacing: 2 }}>PRO</span>
          </div>
          <div className="intro-sub">Bioluminescent Code Intelligence</div>
        </div>

        <div className={`intro-log ${phase === 'log' || phase === 'done' ? 'show' : ''}`}>
          {lines.map((l, i) => (
            <div
              key={i}
              className={`intro-log-line ${l.text.includes('READY') ? 'ready' : ''}`}
              style={{ color: l.color, transition: `color .3s` }}
            >
              {l.text}
            </div>
          ))}
          {phase !== 'done' && lines.length > 0 && (
            <span className="intro-log-cursor" style={{ background: 'var(--amber-glow)' }} />
          )}
          {phase === 'done' && (
            <div className="intro-enter" style={{
              color: 'var(--amber-glow)',
              border: '1px solid rgba(249,115,22,0.3)',
              textShadow: '0 0 16px rgba(249,115,22,0.6)',
            }}>
              [ FORGE READY ]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
