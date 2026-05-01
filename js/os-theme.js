/* ============================================================
   AGE OPS — OS-THEME.JS  (Theme Switcher + Particles)
   ============================================================ */

const THEMES = [
  { id:'theme-red-black', name:'RED', color:'#ff1a1a' },
  { id:'theme-mono',      name:'MONO', color:'#ffffff' },
  { id:'theme-blue-dark', name:'BLUE', color:'#00aaff' },
  { id:'theme-green',     name:'GREEN', color:'#00ff88' },
  { id:'theme-purple',    name:'PURP', color:'#cc44ff' },
  { id:'theme-gold',      name:'GOLD', color:'#ffcc00' },
  { id:'theme-cyan',      name:'CYAN', color:'#00f5ff' },
  { id:'theme-lime',      name:'LIME', color:'#aaff00' },
  { id:'theme-inferno',   name:'FIRE', color:'#ff6600' },
  { id:'theme-arctic',    name:'ICE', color:'#aaddff' },
  { id:'theme-rose',      name:'ROSE', color:'#ff6688' },
  { id:'theme-void',      name:'VOID', color:'#8855ff' }
];

const THEME_KEY = 'ageops_theme';

let currentTheme = localStorage.getItem(THEME_KEY) || 'theme-blue-dark';

function applyTheme(id) {
  currentTheme = id;
  document.documentElement.setAttribute('data-theme', id);
  localStorage.setItem(THEME_KEY, id);
  renderThemeMiniSwitcher();
  rebuildParticles();
}

function renderThemeMiniSwitcher() {
  const wrap = document.getElementById('themeMiniSwitcher');
  if (!wrap) return;
  wrap.innerHTML = THEMES.map(t => `
    <div class="theme-mini-dot ${t.id === currentTheme ? 'active' : ''}"
         style="background:${t.color};"
         title="${t.name}"
         onclick="applyTheme('${t.id}')"></div>
  `).join('');
}

/* ---- PARTICLES ---- */
let particleCanvas, pCtx, particles = [], animId;
const isMobile = () => window.innerWidth <= 768;

function getParticleColors() {
  const style = getComputedStyle(document.documentElement);
  const p = style.getPropertyValue('--c-p').trim() || '#00aaff';
  const s = style.getPropertyValue('--c-s').trim() || '#0066cc';
  return [p, s];
}

function rebuildParticles() {
  if (animId) cancelAnimationFrame(animId);
  particles = [];
  if (!particleCanvas) return;
  const count = isMobile() ? 28 : 55;
  const [c1, c2] = getParticleColors();
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * particleCanvas.width,
      y: Math.random() * particleCanvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.15,
      color: Math.random() > 0.5 ? c1 : c2
    });
  }
  animateParticles();
}

function animateParticles() {
  if (!pCtx || !particleCanvas) return;
  pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  const w = particleCanvas.width, h = particleCanvas.height;
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = w;
    if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    if (p.y > h) p.y = 0;
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    pCtx.fillStyle = p.color;
    pCtx.globalAlpha = p.opacity;
    pCtx.fill();
  });
  pCtx.globalAlpha = 1;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 120) {
        pCtx.beginPath();
        pCtx.moveTo(particles[i].x, particles[i].y);
        pCtx.lineTo(particles[j].x, particles[j].y);
        pCtx.strokeStyle = particles[i].color;
        pCtx.globalAlpha = (1 - d / 120) * 0.12;
        pCtx.lineWidth = 0.7;
        pCtx.stroke();
        pCtx.globalAlpha = 1;
      }
    }
  }
  animId = requestAnimationFrame(animateParticles);
}

function initParticles() {
  particleCanvas = document.getElementById('particles-canvas');
  if (!particleCanvas) return;
  pCtx = particleCanvas.getContext('2d');
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
  rebuildParticles();
  window.addEventListener('resize', () => {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
    rebuildParticles();
  });
}

/* ---- CLOCK ---- */
function startClock() {
  function update() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const el = document.getElementById('topbarClock');
    if (el) el.textContent = `${hh}:${mm}:${ss}`;
  }
  update();
  setInterval(update, 1000);
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  initParticles();
  startClock();
});
