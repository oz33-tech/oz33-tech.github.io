import * as THREE from 'three';

/* =========================================================
   Three.js hero scene
   wireframe icosahedron + particle cloud
   mouse-reactive rotation + auto-spin when idle
   ========================================================= */

const canvas = document.getElementById('bg-canvas');
const heroEl = document.querySelector('.hero');
const readoutFrame = document.getElementById('readout-frame');
const readoutCursor = document.getElementById('readout-cursor');
const readoutMode = document.getElementById('readout-mode');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const LIME = 0xc4ff00;
const INK = 0x0a0a0a;

let renderer, scene, camera, geo, mesh, particles, particlesMesh, frame = 0, lastMouseAt = performance.now();
const target = { x: 0, y: 0 };
const current = { x: 0, y: 0 };

function init() {
  const { clientWidth: w, clientHeight: h } = heroEl;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.setClearColor(INK, 0);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(INK, 5, 22);

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.set(0, 0, 8);

  // Main wireframe form — icosahedron with subtle vertex displacement via shader-modified normals
  geo = new THREE.IcosahedronGeometry(2.4, 2);
  const wireMat = new THREE.MeshBasicMaterial({
    color: LIME,
    wireframe: true,
    transparent: true,
    opacity: .9,
  });
  mesh = new THREE.Mesh(geo, wireMat);
  scene.add(mesh);

  // Inner solid mesh — very dark, just for depth shading silhouette
  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.38, 2),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: .92 })
  );
  scene.add(inner);
  mesh.userData.inner = inner;

  // Particle cloud — small lime dots floating around
  const count = 380;
  const positions = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // shell around the central form
    const r = 4 + Math.random() * 4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[3*i]   = r * Math.sin(phi) * Math.cos(theta);
    positions[3*i+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[3*i+2] = r * Math.cos(phi);
    radii[i] = Math.random();
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  partGeo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
  const partMat = new THREE.PointsMaterial({
    color: LIME,
    size: 0.035,
    transparent: true,
    opacity: .65,
    sizeAttenuation: true,
    depthWrite: false,
  });
  particles = partGeo;
  particlesMesh = new THREE.Points(partGeo, partMat);
  scene.add(particlesMesh);

  window.addEventListener('resize', onResize, { passive: true });
  heroEl.addEventListener('pointermove', onPointer, { passive: true });
  heroEl.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; }, { passive: true });

  if (!reduceMotion) requestAnimationFrame(tick);
  else renderer.render(scene, camera);
}

function onResize() {
  const { clientWidth: w, clientHeight: h } = heroEl;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function onPointer(e) {
  const r = heroEl.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  target.x = (x - 0.5) * 1.6;
  target.y = (y - 0.5) * -1.2;
  lastMouseAt = performance.now();
  if (readoutCursor) readoutCursor.textContent = `${target.x.toFixed(2)}, ${target.y.toFixed(2)}`;
}

// Lime as HSL: H≈74°, S=100%, L=50%
const BASE_H = 74 / 360;
const BASE_S = 1.0;
const BASE_L = 0.5;
const hueTarget = { h: 0, l: 0 };
const hueCurrent = { h: 0, l: 0 };

function tick(t) {
  frame++;
  const idle = performance.now() - lastMouseAt > 1400;

  // smooth follow toward target rotation
  current.x += (target.x - current.x) * 0.06;
  current.y += (target.y - current.y) * 0.06;

  // auto-rotation baseline
  const auto = t * 0.00012;
  mesh.rotation.y = auto + current.x;
  mesh.rotation.x = auto * 0.6 + current.y;
  mesh.userData.inner.rotation.copy(mesh.rotation);

  // gentle particle drift
  particlesMesh.rotation.y = -auto * 0.6;
  particlesMesh.rotation.x = -auto * 0.3;

  // breathing scale
  const breathe = 1 + Math.sin(t * 0.0009) * 0.02;
  mesh.scale.setScalar(breathe);
  mesh.userData.inner.scale.setScalar(breathe);

  // cursor-driven hue shift: cursor.x shifts hue (cool↔warm),
  // cursor.y shifts lightness very slightly. Returns to base when idle.
  hueTarget.h = idle ? 0 : current.x * 0.055;   // ±0.055 ≈ ±20°
  hueTarget.l = idle ? 0 : current.y * 0.04;
  hueCurrent.h += (hueTarget.h - hueCurrent.h) * 0.05;
  hueCurrent.l += (hueTarget.l - hueCurrent.l) * 0.05;
  const h = (BASE_H + hueCurrent.h + 1) % 1;
  const l = Math.max(0.38, Math.min(0.62, BASE_L + hueCurrent.l));
  mesh.material.color.setHSL(h, BASE_S, l);

  renderer.render(scene, camera);

  // UI readouts (cheap throttle)
  if (frame % 3 === 0 && readoutFrame) {
    readoutFrame.textContent = String(frame).padStart(4, '0');
  }
  if (readoutMode) readoutMode.textContent = idle ? 'AUTO' : 'CURSOR';

  requestAnimationFrame(tick);
}

if (canvas) {
  try {
    init();
  } catch (e) {
    // silent fail — page still readable
    canvas.style.display = 'none';
    console.warn('3D scene failed to init:', e);
  }
}

/* =========================================================
   Side-index scroll spy
   ========================================================= */
const sideLinks = document.querySelectorAll('.si-link');
const sections = ['hero','who','work','systems','how','talk'].map(id => document.getElementById(id)).filter(Boolean);

if ('IntersectionObserver' in window) {
  const map = new Map();
  sideLinks.forEach(l => map.set(l.getAttribute('href').slice(1), l));
  const io = new IntersectionObserver((entries) => {
    let best = null;
    let bestRatio = 0;
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio > bestRatio) {
        best = e.target.id; bestRatio = e.intersectionRatio;
      }
    });
    if (best && map.has(best)) {
      sideLinks.forEach(l => l.classList.remove('active'));
      map.get(best).classList.add('active');
    }
  }, { threshold: [.2, .4, .6, .8] });
  sections.forEach(s => io.observe(s));
}

/* =========================================================
   Status bar clock
   ========================================================= */
function tickClock() {
  const sb = document.querySelector('.status-bar .sb-mono');
  if (!sb) return;
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  sb.textContent = `[ DIGITAL WORKSHOP · BRISTOL UK · ${hh}:${mm} UTC ]`;
}
tickClock();
setInterval(tickClock, 30000);

/* =========================================================
   Footer year
   ========================================================= */
const y = document.getElementById('y');
if (y) y.textContent = new Date().getFullYear();

/* =========================================================
   Quick-chat widget — scripted Q&A, no backend
   ========================================================= */
const chatToggle = document.getElementById('chat-toggle');
const chatPanel = document.getElementById('chat-panel');
const chatClose = document.getElementById('chat-close');
const chatBody = document.getElementById('chat-body');
const chatPresets = document.getElementById('chat-presets');

const QA = [
  {
    q: "What does a website cost?",
    a: "Most one-page sites land around <em>£300–£500</em> fully built. Bigger sites are quoted individually depending on what you need. There's an optional <em>£25/month care plan</em> that covers hosting, domain and small content changes — first month free, cancel any time. Want a proper quote for your business?",
  },
  {
    q: "How long does it take?",
    a: "About a week for a one-pager, two weeks for a brochure site, three to four for a full site — once you've signed off the quote. I'll always give you a real date, not a vague 'soon' window.",
  },
  {
    q: "What about my domain?",
    a: "If you don't have one, I'll help you buy one (£8–12/year, registered in <em>your</em> name so you own it). If you do, I just point it at the new site. Either way, you keep control of it.",
  },
  {
    q: "Can I cancel later?",
    a: "Yes — the care plan cancels any time, no notice period. You keep the site, the domain and all the files. No lock-ins, no penalties.",
  },
  {
    q: "Why no price list?",
    a: "Every business is different — a plumber needs different things from a stonemason. I quote each project individually so you don't pay for stuff you don't need. Quotes are always <em>fixed price</em>, written down, broken down.",
  },
  {
    q: "Are you actually real?",
    a: "Yes — Omar Zkiek, Bristol UK. Solo, no agency, no offshore team. Happy to jump on a 10-min call if it helps.",
  },
];

const WELCOME = "Hi — I'm Omar. Tap a question below, or just email me directly.";
const FOLLOWUP = "Anything else? Or shoot me an email and we can take it from there.";

function addBubble(text, who) {
  const div = document.createElement('div');
  div.className = `cp-msg ${who}`;
  div.innerHTML = text;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
  return div;
}

function showTyping() {
  const t = document.createElement('div');
  t.className = 'cp-typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  chatBody.appendChild(t);
  chatBody.scrollTop = chatBody.scrollHeight;
  return t;
}

function renderPresets(remaining) {
  chatPresets.innerHTML = '';
  remaining.forEach(item => {
    const b = document.createElement('button');
    b.className = 'cp-preset';
    b.type = 'button';
    b.textContent = item.q;
    b.addEventListener('click', () => handlePreset(item, remaining));
    chatPresets.appendChild(b);
  });
  const email = document.createElement('a');
  email.className = 'cp-preset primary';
  email.href = 'mailto:omarzkiek3@gmail.com?subject=Hi%20Omar';
  email.textContent = '✉ Email Omar directly';
  chatPresets.appendChild(email);
}

function handlePreset(item, all) {
  addBubble(item.q, 'user');
  const typing = showTyping();
  setTimeout(() => {
    typing.remove();
    addBubble(item.a, 'bot');
    const remaining = all.filter(i => i !== item);
    if (remaining.length) {
      renderPresets(remaining);
    } else {
      chatPresets.innerHTML = '';
      const email = document.createElement('a');
      email.className = 'cp-preset primary';
      email.href = 'mailto:omarzkiek3@gmail.com?subject=Hi%20Omar';
      email.textContent = '✉ Email Omar directly';
      chatPresets.appendChild(email);
      setTimeout(() => addBubble(FOLLOWUP, 'bot'), 400);
    }
  }, 650 + Math.random() * 400);
}

function openChat() {
  if (!chatPanel) return;
  chatPanel.classList.add('is-open');
  chatPanel.setAttribute('aria-hidden', 'false');
  chatToggle?.classList.add('is-open');
  // first time only — show welcome
  if (chatBody && !chatBody.dataset.init) {
    chatBody.dataset.init = '1';
    addBubble(WELCOME, 'bot');
    renderPresets(QA);
  }
}
function closeChat() {
  if (!chatPanel) return;
  chatPanel.classList.remove('is-open');
  chatPanel.setAttribute('aria-hidden', 'true');
  chatToggle?.classList.remove('is-open');
}
chatToggle?.addEventListener('click', openChat);
chatClose?.addEventListener('click', closeChat);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeChat(); });
