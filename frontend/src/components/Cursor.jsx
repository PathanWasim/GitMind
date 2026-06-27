import { useEffect, useRef } from 'react';

/* ── Global custom cursor ──────────────────────────────────
   Dot tracks the pointer instantly (gsap.quickSetter); the ring
   trails with a lerp (gsap.to power2.out). Falls back to a plain
   rAF lerp when GSAP isn't on window. Disabled on touch / mobile /
   reduced-motion. JS owns the transform; CSS owns appearance. */
export default function Cursor() {
  const dot  = useRef(null);
  const ring = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch  = window.matchMedia('(hover: none)').matches;
    if (reduce || touch || window.innerWidth < 768) return;

    const d = dot.current, r = ring.current;
    if (!d || !r) return;

    const gsap = window.gsap;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rafId = 0, killGsap = null;

    const onMove = e => { mx = e.clientX; my = e.clientY; };

    if (gsap) {
      gsap.set([d, r], { xPercent: -50, yPercent: -50 });
      const setDotX  = gsap.quickSetter(d, 'x', 'px');
      const setDotY  = gsap.quickSetter(d, 'y', 'px');
      const ringObj  = { x: mx, y: my };
      const setRingX = gsap.quickSetter(r, 'x', 'px');
      const setRingY = gsap.quickSetter(r, 'y', 'px');

      const tick = () => {
        setDotX(mx); setDotY(my);
        // lerp the ring toward the pointer (power2.out feel)
        ringObj.x += (mx - ringObj.x) * 0.18;
        ringObj.y += (my - ringObj.y) * 0.18;
        setRingX(ringObj.x); setRingY(ringObj.y);
      };
      gsap.ticker.add(tick);
      killGsap = () => gsap.ticker.remove(tick);
    } else {
      // Fallback: raw transform, JS-owned, no GSAP.
      let rx = mx, ry = my;
      const half = (el) => el.offsetWidth / 2;
      const loop = () => {
        rafId = requestAnimationFrame(loop);
        rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
        d.style.transform = `translate(${mx - half(d)}px, ${my - half(d)}px)`;
        r.style.transform = `translate(${rx - half(r)}px, ${ry - half(r)}px)`;
      };
      loop();
    }

    const down = () => r.classList.add('clicking');
    const up   = () => r.classList.remove('clicking');

    // Hover + crosshair states, re-bound as the DOM changes.
    const enter = () => { d.classList.add('hovering'); r.classList.add('hovering'); };
    const leave = () => { d.classList.remove('hovering'); r.classList.remove('hovering'); };
    const crossOn  = () => { d.classList.add('crosshair'); r.classList.add('crosshair'); };
    const crossOff = () => { d.classList.remove('crosshair'); r.classList.remove('crosshair'); };

    const bind = () => {
      document.querySelectorAll('a,button,[data-hover]').forEach(el => {
        el.addEventListener('mouseenter', enter);
        el.addEventListener('mouseleave', leave);
      });
      document.querySelectorAll('[data-cursor="crosshair"]').forEach(el => {
        el.addEventListener('mouseenter', crossOn);
        el.addEventListener('mouseleave', crossOff);
      });
    };
    bind();
    const mo = new MutationObserver(bind);
    mo.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mousedown', down);
    document.addEventListener('mouseup', up);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('mouseup', up);
      mo.disconnect();
      if (killGsap) killGsap();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div ref={dot}  className="cursor-dot" />
      <div ref={ring} className="cursor-ring" />
    </>
  );
}
