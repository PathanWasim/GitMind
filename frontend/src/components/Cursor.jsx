import { useEffect, useRef } from 'react';

export default function Cursor() {
  const dot  = useRef(null);
  const ring = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
