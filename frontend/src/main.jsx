import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/* ── Register GSAP plugins globally (loaded via CDN in index.html) ──
   Guarded: if the CDN failed to load, the app still mounts and runs
   with all GSAP-driven motion gracefully skipped. ScrollSmoother is
   *created* per-page inside LandingPage, not here, so it never fights
   the fixed AppPage layout or React Router route changes. */
const g = typeof window !== 'undefined' ? window.gsap : undefined;
if (g) {
  const plugins = [window.ScrollTrigger, window.ScrollSmoother, window.SplitText].filter(Boolean);
  if (plugins.length) g.registerPlugin(...plugins);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
