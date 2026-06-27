import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ── Inline 3D value noise (no external lib) ──────────────── */
function hash(n) {
  let x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const n000 = hash(ix + hash(iy + hash(iz)));
  const n100 = hash(ix + 1 + hash(iy + hash(iz)));
  const n010 = hash(ix + hash(iy + 1 + hash(iz)));
  const n110 = hash(ix + 1 + hash(iy + 1 + hash(iz)));
  const n001 = hash(ix + hash(iy + hash(iz + 1)));
  const n101 = hash(ix + 1 + hash(iy + hash(iz + 1)));
  const n011 = hash(ix + hash(iy + 1 + hash(iz + 1)));
  const n111 = hash(ix + 1 + hash(iy + 1 + hash(iz + 1)));
  return (
    n000 * (1-ux) * (1-uy) * (1-uz) + n100 * ux * (1-uy) * (1-uz) +
    n010 * (1-ux) * uy * (1-uz)     + n110 * ux * uy * (1-uz) +
    n001 * (1-ux) * (1-uy) * uz     + n101 * ux * (1-uy) * uz +
    n011 * (1-ux) * uy * uz         + n111 * ux * uy * uz
  ) * 2 - 1;
}

/* ── Mobile detection ─────────────────────────────────────── */
const isMobile = () => window.innerWidth < 768;

/* ── Mobile fallback: CSS conic gradient ─────────────────── */
function MobileGradient() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'conic-gradient(from 0deg at 30% 40%, #08060F 0%, #1A0A04 20%, #0D1A12 40%, #08060F 60%, #1A0804 80%, #08060F 100%)',
        animation: 'bgPulse 8s ease-in-out infinite',
      }}
    />
  );
}

export default function ThreeBackground() {
  const ref = useRef(null);

  if (isMobile()) return <MobileGradient />;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (isMobile()) return;

    const el = ref.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    /* ── Renderer ──────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x08060F, 1);
    renderer.shadowMap.enabled = false;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08060F);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 0, 8);

    /* ── Lights ────────────────────────────────────────────── */
    const ambientLight = new THREE.AmbientLight(0xF5E8D8, 0.4);
    scene.add(ambientLight);

    const amberLight = new THREE.PointLight(0xF97316, 3, 20);
    amberLight.position.set(5, 5, 5);
    scene.add(amberLight);

    const tealLight = new THREE.PointLight(0x0D9488, 2, 20);
    tealLight.position.set(-5, -3, 5);
    scene.add(tealLight);

    /* ── Store original vertex positions for morphing ──────── */
    function createBlob(radius, segments, color, roughness = 0.0, metalness = 0.8) {
      const geo = new THREE.SphereGeometry(radius, segments, segments);
      const posAttr = geo.attributes.position;

      // Store original positions for morphing
      const origPos = new Float32Array(posAttr.array.length);
      origPos.set(posAttr.array);
      geo.userData.origPos = origPos;

      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color),
        roughness,
        metalness,
        envMapIntensity: 1.5,
        transmission: 0.3,
        transparent: true,
        opacity: 0.92,
      });

      const mesh = new THREE.Mesh(geo, mat);
      return mesh;
    }

    /* ── Central blob ──────────────────────────────────────── */
    const centralBlob = createBlob(2.0, 80, 0xC2410C);
    scene.add(centralBlob);

    /* ── Satellite blobs ───────────────────────────────────── */
    const satellites = [
      { blob: createBlob(0.7, 48, 0x0D9488, 0.1, 0.7), speed: 0.4, incl: 0.3,  radius: 3.2, phase: 0 },
      { blob: createBlob(0.9, 48, 0xEAB308, 0.05, 0.9), speed: 0.25, incl: 1.1, radius: 3.8, phase: 2.1 },
      { blob: createBlob(0.6, 48, 0xC2410C, 0.0, 0.95), speed: 0.55, incl: -0.6, radius: 2.9, phase: 4.2 },
    ];
    satellites.forEach(s => scene.add(s.blob));

    /* ── Particles in river streams ────────────────────────── */
    const PARTICLE_COUNT = 4000;
    const pPositions = new Float32Array(PARTICLE_COUNT * 3);
    const pColors    = new Float32Array(PARTICLE_COUNT * 3);
    const pSizes     = new Float32Array(PARTICLE_COUNT);
    const pParams    = new Float32Array(PARTICLE_COUNT * 2); // t, streamId

    const palette = [
      [0xC2 / 255, 0x41 / 255, 0x0C / 255], // amber-deep
      [0xF9 / 255, 0x73 / 255, 0x16 / 255], // amber-glow
      [0x0D / 255, 0x94 / 255, 0x88 / 255], // bio-teal
      [0x2D / 255, 0xD4 / 255, 0xBF / 255], // bio-bright
      [0xEA / 255, 0xB3 / 255, 0x08 / 255], // plasma-gold
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      const stream = Math.floor(Math.random() * 6); // 6 stream types
      pParams[i * 2]     = t;
      pParams[i * 2 + 1] = stream;

      // Initial positions (will be updated each frame)
      pPositions[i * 3]     = 0;
      pPositions[i * 3 + 1] = 0;
      pPositions[i * 3 + 2] = 0;

      const pc = palette[Math.floor(Math.random() * palette.length)];
      const jitter = () => (Math.random() - 0.5) * 0.15;
      pColors[i * 3]     = Math.min(1, pc[0] + jitter());
      pColors[i * 3 + 1] = Math.min(1, pc[1] + jitter());
      pColors[i * 3 + 2] = Math.min(1, pc[2] + jitter());

      pSizes[i] = 0.8 + Math.random() * 1.6;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    particleGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));
    particleGeo.setAttribute('size',     new THREE.BufferAttribute(pSizes, 1));

    const particleMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = (1.0 - smoothstep(0.0, 0.5, d)) * 0.75;
          gl_FragColor = vec4(vColor, a);
        }
      `,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* ── Mouse parallax ────────────────────────────────────── */
    let targetMX = 0, targetMY = 0, currentMX = 0, currentMY = 0;
    const onMouseMove = e => {
      targetMX = (e.clientX / window.innerWidth  - 0.5) * 2;
      targetMY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    /* ── Resize ────────────────────────────────────────────── */
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    /* ── Particle stream position functions ────────────────── */
    function streamPos(stream, t, time) {
      const tt = (t + time * 0.05) % 1;
      const angle = tt * Math.PI * 2;
      let x, y, z;

      switch (stream % 6) {
        case 0: { // helix 1
          const r = 3.5 + Math.sin(tt * Math.PI * 4) * 0.5;
          x = r * Math.cos(angle * 3);
          y = (tt - 0.5) * 6;
          z = r * Math.sin(angle * 3);
          break;
        }
        case 1: { // helix 2 — opposite phase
          const r = 3.2 + Math.cos(tt * Math.PI * 3) * 0.6;
          x = r * Math.cos(angle * 3 + Math.PI);
          y = (tt - 0.5) * 6;
          z = r * Math.sin(angle * 3 + Math.PI);
          break;
        }
        case 2: { // figure-8 equatorial
          const scale = 4.0;
          x = scale * Math.sin(angle);
          y = scale * Math.sin(angle * 2) * 0.5;
          z = scale * Math.cos(angle);
          break;
        }
        case 3: { // polar orbit
          const r2 = 4.2;
          x = r2 * Math.sin(angle) * Math.cos(tt * Math.PI);
          y = r2 * Math.cos(angle);
          z = r2 * Math.sin(angle) * Math.sin(tt * Math.PI);
          break;
        }
        case 4: { // tight spiral inward
          const r3 = 2.5 + (1 - tt) * 2.5;
          x = r3 * Math.cos(angle * 5);
          y = (tt - 0.5) * 3;
          z = r3 * Math.sin(angle * 5);
          break;
        }
        default: { // loose drift
          const r4 = 5 + Math.sin(tt * Math.PI * 6 + 1.2) * 1.5;
          x = r4 * Math.cos(angle * 1.5 + 0.8);
          y = (tt - 0.5) * 8;
          z = r4 * Math.sin(angle * 1.5 + 0.8);
        }
      }
      return [x, y, z];
    }

    /* ── Animation loop ────────────────────────────────────── */
    let animId;
    const animate = (timestamp) => {
      animId = requestAnimationFrame(animate);
      const t = timestamp * 0.001;

      /* Mouse lerp */
      currentMX += (targetMX - currentMX) * 0.05;
      currentMY += (targetMY - currentMY) * 0.05;

      /* Central blob morphing via noise-based vertex displacement */
      {
        const geo = centralBlob.geometry;
        const posAttr = geo.attributes.position;
        const orig = geo.userData.origPos;
        const normals = geo.attributes.normal;

        for (let i = 0; i < posAttr.count; i++) {
          const ox = orig[i * 3], oy = orig[i * 3 + 1], oz = orig[i * 3 + 2];
          const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
          // Noise-based morphing
          const disp = (
            Math.sin(t * 0.3 + ox * 2) * 0.3 +
            noise3(ox * 1.2 + t * 0.2, oy * 1.2, oz * 1.2) * 0.25
          );
          posAttr.setXYZ(i, ox + nx * disp, oy + ny * disp, oz + nz * disp);
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
      }

      /* Satellite morphing + orbit */
      satellites.forEach((s, idx) => {
        const angle = t * s.speed + s.phase;
        const x = Math.cos(angle) * s.radius;
        const y = Math.sin(angle * 0.7) * s.radius * Math.sin(s.incl);
        const z = Math.sin(angle) * s.radius;
        s.blob.position.set(x + currentMX * 0.8, y + currentMY * 0.8, z);

        const geo = s.blob.geometry;
        const posAttr = geo.attributes.position;
        const orig = geo.userData.origPos;
        const normals = geo.attributes.normal;
        for (let i = 0; i < posAttr.count; i++) {
          const ox = orig[i * 3], oy = orig[i * 3 + 1], oz = orig[i * 3 + 2];
          const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
          const disp = Math.sin(t * 0.5 + ox * 3 + idx) * 0.15;
          posAttr.setXYZ(i, ox + nx * disp, oy + ny * disp, oz + nz * disp);
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
      });

      /* Central blob mouse parallax */
      centralBlob.position.set(currentMX * 0.8, currentMY * 0.8, 0);
      centralBlob.rotation.y = t * 0.08;
      centralBlob.rotation.x = t * 0.05;

      /* Update particle positions */
      const pPos = particleGeo.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particleT = pParams[i * 2];
        const stream    = pParams[i * 2 + 1];
        const [px, py, pz] = streamPos(stream, particleT, t);
        pPos[i * 3]     = px;
        pPos[i * 3 + 1] = py;
        pPos[i * 3 + 2] = pz;
      }
      particleGeo.attributes.position.needsUpdate = true;

      /* Lights breathe */
      amberLight.intensity = 2.5 + Math.sin(t * 0.7) * 0.8;
      tealLight.intensity  = 1.5 + Math.sin(t * 0.5 + 1) * 0.7;

      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);

    /* ── Cleanup ───────────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);

      centralBlob.geometry.dispose();
      centralBlob.material.dispose();
      satellites.forEach(s => { s.blob.geometry.dispose(); s.blob.material.dispose(); });
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
