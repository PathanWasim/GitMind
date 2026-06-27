import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ════════════════════════════════════════════════════════════
   THE CODEBASE UNIVERSE
   A fixed 3D scene behind the scroll story. 200 glowing cubes
   ("files") + a central TorusKnot ("AI core"). Scroll progress
   (read straight from window.scrollY — ScrollSmoother keeps the
   native scroll position valid) drives the camera dolly and the
   cube choreography across the 6 acts:

     cloud → column(clone/scan) → cluster+orbit(embed/answer) → recede(cta)

   Decoupled from GSAP on purpose: no ScrollTrigger here means no
   plugin-load/ordering races. Degrades to a CSS gradient on mobile
   or with prefers-reduced-motion.
════════════════════════════════════════════════════════════ */

const isMobile = () => window.innerWidth < 768;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

/* Piecewise-linear keyframe interpolation: keys = [[pos,val],...] */
function lerpKeys(keys, p) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1], [p1, v1] = keys[i];
      return lerp(v0, v1, (p - p0) / (p1 - p0 || 1));
    }
  }
  return keys[keys.length - 1][1];
}

const CAM_Z   = [[0,12],[0.16,12],[0.33,8],[0.50,6],[0.66,5],[0.83,10],[1,14]];
const CAM_X   = [[0,0],[0.16,0],[0.33,-1],[0.50,-0.5],[0.66,0],[1,0]];
const CAM_ROT = [[0,0],[0.33,0],[0.42,0.05],[0.50,0],[1,0]];

export default function ThreeBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || isMobile()) {
      el.style.background =
        'conic-gradient(from 210deg at 70% 30%, #07050E, #1A0A04 22%, #0A1714 45%, #07050E 65%, #1A0804 85%, #07050E)';
      return;
    }

    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;

    /* ── Renderer / scene / camera ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x07050e, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07050e);
    scene.fog = new THREE.FogExp2(0x07050e, 0.035);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 0, 12);

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0xf5e8d8, 0.35));
    const amberLight = new THREE.PointLight(0xf97316, 2, 40);
    amberLight.position.set(3, 3, 3);
    scene.add(amberLight);
    const tealLight = new THREE.PointLight(0x0d9488, 1.5, 40);
    tealLight.position.set(-3, -2, 3);
    scene.add(tealLight);

    /* ── AI core: TorusKnot ── */
    const knotGeo = new THREE.TorusKnotGeometry(0.8, 0.25, 120, 16);
    const knotMat = new THREE.MeshPhysicalMaterial({
      color: 0xf97316, metalness: 0.9, roughness: 0.1,
      iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 1.2,
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    scene.add(knot);

    /* ── 200 "file" cubes via a single InstancedMesh ── */
    const COUNT = 200;
    const cubeGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const cubeMat = new THREE.MeshStandardMaterial({
      metalness: 0.6, roughness: 0.35, emissive: 0x1a0a04, emissiveIntensity: 0.4,
    });
    const cubes = new THREE.InstancedMesh(cubeGeo, cubeMat, COUNT);
    cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(cubes);

    const AMBER = new THREE.Color(0xf97316);
    const TEAL  = new THREE.Color(0x0d9488);
    const GOLD  = new THREE.Color(0xeab308);

    // Per-cube state: cloud pos, column pos, orbit params, spin, color
    const data = [];
    for (let i = 0; i < COUNT; i++) {
      const base = i % 3 === 0 ? GOLD : i % 2 === 0 ? AMBER : TEAL;
      data.push({
        cloud: new THREE.Vector3(
          (Math.random() - 0.5) * 11,
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9
        ),
        column: new THREE.Vector3(
          2.3 + (i % 4) * 0.32,
          (i / 4 - COUNT / 8) * 0.22,
          (Math.random() - 0.5) * 0.6
        ),
        orbitR: 1.5 + (i % 5) * 0.28,
        orbitA: i * 0.41,
        orbitY: ((i % 7) - 3) * 0.32,
        orbitS: 0.15 + (i % 4) * 0.06,
        spin: new THREE.Vector3(Math.random() * 0.02, Math.random() * 0.02, Math.random() * 0.02),
        floatPh: Math.random() * Math.PI * 2,
        base, color: base.clone(),
      });
      cubes.setColorAt(i, base);
    }
    cubes.instanceColor.needsUpdate = true;

    /* ── Scan plane (Act 3) ── */
    const scanGeo = new THREE.PlaneGeometry(9, 0.06);
    const scanMat = new THREE.MeshBasicMaterial({
      color: 0xf97316, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const scanPlane = new THREE.Mesh(scanGeo, scanMat);
    scanPlane.position.set(2.8, 0, 0.5);
    scene.add(scanPlane);

    /* ── Neural connection lines (Act 4) ── */
    const LINE_N = 60;
    const linePos = new Float32Array(LINE_N * 2 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x2dd4bf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    /* ── Shockwave ring (Act 5) ── */
    const ringGeo = new THREE.TorusGeometry(1, 0.04, 8, 60);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xeab308, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);

    /* ── Golden particle stream from the core (Act 5) ── */
    const GP = 50;
    const gpPos = new Float32Array(GP * 3);
    const gpDir = [];
    for (let i = 0; i < GP; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      gpDir.push(v);
    }
    const gpGeo = new THREE.BufferGeometry();
    gpGeo.setAttribute('position', new THREE.BufferAttribute(gpPos, 3));
    const gpMat = new THREE.PointsMaterial({
      color: 0xeab308, size: 0.08, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const goldParticles = new THREE.Points(gpGeo, gpMat);
    scene.add(goldParticles);

    /* ── Mouse parallax ── */
    let tMX = 0, tMY = 0, cMX = 0, cMY = 0;
    const onMouse = (e) => {
      tMX = (e.clientX / window.innerWidth - 0.5) * 2;
      tMY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);

    const onResize = () => {
      const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    /* ── Scroll progress (native scroll pos works under ScrollSmoother) ── */
    let prog = 0;
    const readScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? clamp01(window.scrollY / max) : 0;
    };

    const dummy = new THREE.Object3D();
    const tmp = new THREE.Vector3();
    const knotPos = new THREE.Vector3();
    const WHITE = new THREE.Color(0xffffff);
    let animId, running = true, wasScan = false;

    const animate = (ts) => {
      if (!running) return;
      animId = requestAnimationFrame(animate);
      const t = ts * 0.001;

      // Smooth scroll progress + mouse
      prog += (readScroll() - prog) * 0.08;
      cMX += (tMX - cMX) * 0.05; cMY += (tMY - cMY) * 0.05;
      const p = prog;

      // ── Camera ──
      camera.position.z = lerpKeys(CAM_Z, p) + cMX * 0.3;
      camera.position.x = lerpKeys(CAM_X, p) + cMX * 0.5;
      camera.position.y = cMY * 0.5 + lerp(0, 0.6, smooth((p - 0.5) / 0.16));
      camera.rotation.z = lerpKeys(CAM_ROT, p);
      camera.lookAt(0, 0, 0);

      // ── Formation weights ──
      const wColumn  = smooth((p - 0.16) / 0.20);                 // cloud → column
      const wCluster = smooth((p - 0.45) / 0.17);                 // column → orbit/cluster

      // ── AI core choreography ──
      const knotX = lerp(0, -2, smooth((p - 0.16) / 0.14)) * (1 - wCluster);
      const knotScaleBase = lerp(1, 0.6, smooth((p - 0.16) / 0.14));
      // Act5 pulse (0.66–0.83)
      const a5 = clamp01((p - 0.66) / 0.17);
      const pulse = Math.sin(a5 * Math.PI) * 0.25;
      const a6 = clamp01((p - 0.83) / 0.17);
      const knotScale = lerp(knotScaleBase, 0.5, a6) * (1 + pulse);
      knot.position.set(knotX + cMX * 0.4, cMY * 0.4, 0);
      knot.scale.setScalar(knotScale);
      knot.rotation.x = t * 0.25;
      knot.rotation.y = t * 0.35;
      knotPos.copy(knot.position);

      // ── Cubes ──
      const scanActive = p > 0.30 && p < 0.52;
      const scanY = lerp(4.5, -4.5, smooth((p - 0.33) / 0.17));
      scanPlane.position.y = scanY;
      scanMat.opacity = scanActive ? lerp(0, 0.9, Math.sin(clamp01((p - 0.33) / 0.17) * Math.PI)) : 0;

      // Colors only need re-upload while scanning, or once when it ends.
      const resetColors = !scanActive && wasScan;
      let colorsTouched = false;

      for (let i = 0; i < COUNT; i++) {
        const d = data[i];
        // base position: cloud → column → orbit
        tmp.copy(d.cloud).lerp(d.column, wColumn);
        if (wCluster > 0) {
          const a = d.orbitA + t * d.orbitS;
          const ox = Math.cos(a) * d.orbitR + knotPos.x;
          const oy = d.orbitY + Math.sin(a * 1.3) * 0.3 + knotPos.y;
          const oz = Math.sin(a) * d.orbitR;
          tmp.x = lerp(tmp.x, ox, wCluster);
          tmp.y = lerp(tmp.y, oy, wCluster);
          tmp.z = lerp(tmp.z, oz, wCluster);
        }
        // gentle float
        tmp.y += Math.sin(t * 0.8 + d.floatPh) * 0.05 * (1 - wCluster);

        dummy.position.copy(tmp);
        dummy.rotation.set(t * d.spin.x * 60, t * d.spin.y * 60, t * d.spin.z * 60);
        dummy.scale.setScalar(lerp(1, 0.85, wCluster));
        dummy.updateMatrix();
        cubes.setMatrixAt(i, dummy.matrix);

        if (scanActive) {
          const near = 1 - clamp01(Math.abs(tmp.y - scanY) / 0.7);
          d.color.copy(d.base).lerp(WHITE, near * 0.8);
          cubes.setColorAt(i, d.color);
          colorsTouched = true;
        } else if (resetColors) {
          cubes.setColorAt(i, d.base);
          colorsTouched = true;
        }
      }
      cubes.instanceMatrix.needsUpdate = true;
      if (colorsTouched) cubes.instanceColor.needsUpdate = true;
      wasScan = scanActive;

      // ── Connection lines (Act 4) ──
      const lineOn = clamp01((p - 0.50) / 0.12);
      lineMat.opacity = lineOn * 0.4 * (1 - a6);
      if (lineMat.opacity > 0.01) {
        for (let i = 0; i < LINE_N; i++) {
          const d = data[i];
          const a = d.orbitA + t * d.orbitS;
          const ox = Math.cos(a) * d.orbitR + knotPos.x;
          const oy = d.orbitY + knotPos.y;
          const oz = Math.sin(a) * d.orbitR;
          linePos.set([ox, oy, oz, knotPos.x, knotPos.y, knotPos.z], i * 6);
        }
        lineGeo.attributes.position.needsUpdate = true;
      }

      // ── Shockwave + gold particles (Act 5) ──
      ringMat.opacity = Math.sin(a5 * Math.PI) * 0.6;
      ring.scale.setScalar(lerp(0.3, 3.2, a5));
      ring.position.copy(knotPos);
      ring.rotation.x = Math.PI / 2.4;
      gpMat.opacity = Math.sin(a5 * Math.PI) * 0.9;
      for (let i = 0; i < GP; i++) {
        const reach = a5 * (2 + (i % 5) * 0.5);
        gpPos.set([
          knotPos.x + gpDir[i].x * reach,
          knotPos.y + gpDir[i].y * reach,
          knotPos.z + gpDir[i].z * reach,
        ], i * 3);
      }
      gpGeo.attributes.position.needsUpdate = true;

      // Lights breathe
      amberLight.intensity = 2 + Math.sin(t * 0.7) * 0.6;
      tealLight.intensity = 1.5 + Math.sin(t * 0.5 + 1) * 0.5;

      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);

    /* ── Cleanup ── */
    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      knotGeo.dispose(); knotMat.dispose();
      cubeGeo.dispose(); cubeMat.dispose(); cubes.dispose();
      scanGeo.dispose(); scanMat.dispose();
      lineGeo.dispose(); lineMat.dispose();
      ringGeo.dispose(); ringMat.dispose();
      gpGeo.dispose(); gpMat.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="s-three"
      style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(249,115,22,0.04), transparent 70%)' }}
    />
  );
}
