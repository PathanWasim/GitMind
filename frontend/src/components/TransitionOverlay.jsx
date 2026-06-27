import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/* ── Route transition: a full-screen amber sweep wipes across on
   every path change. Two-phase clip-path (enter from left → cover →
   exit to the right) via the `amber-sweep` keyframe. Skipped on the
   very first render and under prefers-reduced-motion. ── */
export default function TransitionOverlay() {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const prev = useRef(location.pathname);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; prev.current = location.pathname; return; }
    if (location.pathname === prev.current) return;
    prev.current = location.pathname;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 620);
    return () => clearTimeout(t);
  }, [location]);

  if (!active) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none',
        background: 'linear-gradient(135deg, #C2410C 0%, #F97316 55%, #0D9488 100%)',
        clipPath: 'inset(0 100% 0 0)',
        animation: 'amber-sweep .6s cubic-bezier(.65,0,.35,1) forwards',
      }}
    />
  );
}
