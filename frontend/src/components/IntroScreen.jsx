import { useState, useEffect } from 'react';

const BOOT = [
  '> INITIALIZING NEURAL ENGINE...',
  '> LOADING SENTENCE TRANSFORMERS...',
  '> CONNECTING TO GROQ / LLAMA-3.3-70B...',
  '> VECTOR DATABASE ONLINE...',
  '> SYSTEM READY.',
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
          <div className="intro-glyph">🧠</div>
          <div className="intro-wordmark">GitMind Pro</div>
          <div className="intro-sub">Neural Code Analysis System</div>
        </div>

        <div className={`intro-log ${phase === 'log' || phase === 'done' ? 'show' : ''}`}>
          {lines.map((l, i) => (
            <div key={i} className={`intro-log-line ${l.includes('READY') ? 'ready' : ''}`}>{l}</div>
          ))}
          {phase !== 'done' && lines.length > 0 && <span className="intro-log-cursor" />}
          {phase === 'done' && <div className="intro-enter">[ LAUNCHING ]</div>}
        </div>
      </div>
    </div>
  );
}
