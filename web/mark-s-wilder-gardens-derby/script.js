// Nav: scrolled state + mobile toggle
const nav = document.getElementById('nav');
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

const onScroll = () => {
  nav.classList.toggle('scrolled', window.scrollY > 8);
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

navToggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});
navLinks?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Footer year
const y = document.getElementById('y');
if (y) y.textContent = new Date().getFullYear();

// 3D hero — mouse / device-tilt parallax
(() => {
  const hero = document.querySelector('.hero-3d');
  const scene = hero?.querySelector('.hero-scene');
  if (!hero || !scene) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let rafId = 0;
  let targetX = 0, targetY = 0;
  let currX = 0, currY = 0;

  const onMove = (e) => {
    const r = hero.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    targetX = (px - 0.5) * 8;   // max ~8deg rotateY
    targetY = (py - 0.5) * -6;  // max ~6deg rotateX
    if (!rafId) tick();
  };

  const onLeave = () => { targetX = 0; targetY = 0; if (!rafId) tick(); };

  const tick = () => {
    currX += (targetX - currX) * 0.08;
    currY += (targetY - currY) * 0.08;
    scene.style.transform = `rotateY(${currX.toFixed(2)}deg) rotateX(${currY.toFixed(2)}deg)`;
    if (Math.abs(targetX - currX) > 0.02 || Math.abs(targetY - currY) > 0.02) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = 0;
    }
  };

  hero.addEventListener('mousemove', onMove, { passive: true });
  hero.addEventListener('mouseleave', onLeave);

  // Touch devices — gentle device-orientation tilt
  if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta == null || e.gamma == null) return;
      targetX = Math.max(-8, Math.min(8, e.gamma / 4));
      targetY = Math.max(-6, Math.min(6, (e.beta - 45) / 6));
      if (!rafId) tick();
    });
  }
})();

// Form handler — opens mail client with prefilled body, target email from data-target
const form = document.getElementById('quoteForm');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const body = [
    `Name: ${data.get('name') || ''}`,
    `Phone: ${data.get('phone') || ''}`,
    `Email: ${data.get('email') || ''}`,
    `Postcode: ${data.get('postcode') || ''}`,
    `Service: ${data.get('service') || ''}`,
    '',
    'Details:',
    data.get('msg') || ''
  ].join('\n');
  const subject = encodeURIComponent('Website enquiry — quote request');
  const target = form.getAttribute('data-target') || '';
  const mailto = `mailto:${target}?subject=${subject}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
});
