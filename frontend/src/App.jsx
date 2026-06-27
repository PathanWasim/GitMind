import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import LandingPage from './pages/LandingPage';
import AppPage from './pages/AppPage';
import Cursor from './components/Cursor';

/* ─── Amber sweep page transition ──────────────────────── */
function TransitionOverlay() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const prev = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prev.current) return;
    prev.current = location.pathname;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, [location]);

  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none',
      background: 'linear-gradient(135deg, rgba(194,65,12,0.85) 0%, rgba(249,115,22,0.6) 50%, rgba(13,148,136,0.4) 100%)',
      animation: 'amber-sweep .6s var(--ease) both',
    }} />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Cursor />
      <TransitionOverlay />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppPage />} />
      </Routes>
    </BrowserRouter>
  );
}
