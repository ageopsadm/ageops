/* ============================================================
   AGE OPS — OS-GAME.JS
   Sistema completo de gamificação:
   · XP + Níveis
   · Combo multiplier
   · Conquistas / Achievements
   · Confetti
   · Floats de +XP
   · Mission Complete overlay
   · Level Up overlay
   · Sons via AudioContext
   ============================================================ */

/* ── XP TABLES ─────────────────────────────────────────── */
const XP_PER_TASK     = 10;   // XP base por tarefa concluída
const XP_DAY_BONUS    = 50;   // Bônus por completar 100% do dia
const XP_FINANCE      = 15;   // XP por marcar recebimento
const COMBO_WINDOW_MS = 4000; // janela de combo (ms)

const LEVELS = [
  { level:1,  min:0,    name:'RECRUTA',    color:'#aaaaaa' },
  { level:2,  min:100,  name:'OPERADOR',   color:'#00aaff' },
  { level:3,  min:250,  name:'AGENTE',     color:'#00ccff' },
  { level:4,  min:500,  name:'ESPECIALISTA', color:'#cc44ff' },
  { level:5,  min:900,  name:'ELITE',      color:'#ffcc00' },
  { level:6,  min:1400, name:'COMANDANTE', color:'#ff6600' },
  { level:7,  min:2000, name:'MESTRE',     color:'#ff2244' },
  { level:8,  min:3000, name:'LENDA',      color:'#ff1a1a' },
];

const ACHIEVEMENTS = [
  { id:'first_task',   icon:'⚡', title:'PRIMEIRA MISSÃO',     desc:'Complete sua 1ª tarefa',       xp:25,  condition: s => s.totalDone >= 1 },
  { id:'five_tasks',   icon:'🔥', title:'EM CHAMAS',           desc:'Complete 5 tarefas',           xp:50,  condition: s => s.totalDone >= 5 },
  { id:'ten_tasks',    icon:'💥', title:'IMPARÁVEL',           desc:'Complete 10 tarefas',          xp:100, condition: s => s.totalDone >= 10 },
  { id:'day_complete', icon:'🎯', title:'DIA ZERADO',          desc:'100% em um dia',               xp:75,  condition: s => s.daysCompleted >= 1 },
  { id:'two_days',     icon:'🏆', title:'DUPLA MISSÃO',        desc:'Complete 2 dias inteiros',     xp:120, condition: s => s.daysCompleted >= 2 },
  { id:'all_days',     icon:'👑', title:'SEMANA ZERADA',       desc:'Complete todos os dias',       xp:300, condition: s => s.daysCompleted >= 6 },
  { id:'combo3',       icon:'🌟', title:'COMBO x3',            desc:'3 tarefas em sequência rápida',xp:40,  condition: s => s.maxCombo >= 3 },
  { id:'combo5',       icon:'⚡', title:'HYPER COMBO',         desc:'5 tarefas em sequência rápida',xp:80,  condition: s => s.maxCombo >= 5 },
  { id:'finance1',     icon:'💰', title:'PRIMEIRO CAIXA',      desc:'Registre 1 recebimento',       xp:30,  condition: s => s.financeDone >= 1 },
  { id:'finance5',     icon:'💎', title:'MESTRE DAS FINANÇAS', desc:'Registre 5 recebimentos',      xp:80,  condition: s => s.financeDone >= 5 },
];

/* ── STATE ─────────────────────────────────────────────── */
const GAME_KEY = 'ageops_game_';

let gameState = {
  xp: 0,
  level: 1,
  totalDone: 0,
  daysCompleted: 0,
  financeDone: 0,
  maxCombo: 0,
  unlockedAchievements: [],
};

let comboCount    = 0;
let comboTimer    = null;
let comboDisplayTimer = null;

function gameStateKey() {
  return GAME_KEY + (window._currentUserGame || 'guest');
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(gameStateKey());
    if (raw) gameState = { ...gameState, ...JSON.parse(raw) };
  } catch(e) {}
}

function saveGameState() {
  try {
    localStorage.setItem(gameStateKey(), JSON.stringify(gameState));
  } catch(e) {}
}

function initGame(username) {
  window._currentUserGame = username;
  loadGameState();
  renderXpBar();
}

/* ── LEVEL UTILS ────────────────────────────────────────── */
function getLevelInfo(xp) {
  let current = LEVELS[0];
  let next    = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) {
      current = LEVELS[i];
      next    = LEVELS[i + 1] || null;
      break;
    }
  }
  return { current, next };
}

function getXpPct(xp) {
  const { current, next } = getLevelInfo(xp);
  if (!next) return 100;
  const range = next.min - current.min;
  const prog  = xp - current.min;
  return Math.min(100, Math.round((prog / range) * 100));
}

/* ── RENDER XP BAR ──────────────────────────────────────── */
function renderXpBar() {
  const { current, next } = getLevelInfo(gameState.xp);
  const pct = getXpPct(gameState.xp);

  const lvlEl  = document.getElementById('sidebarLvl');
  const ptsEl  = document.getElementById('sidebarXpPts');
  const fillEl = document.getElementById('sidebarXpFill');

  if (lvlEl)  lvlEl.textContent  = `LVL ${current.level} · ${current.name}`;
  if (lvlEl)  lvlEl.style.color  = current.color;
  if (ptsEl)  ptsEl.textContent  = next
    ? `${gameState.xp - current.min} / ${next.min - current.min} XP`
    : `${gameState.xp} XP · MAX`;
  if (fillEl) {
    fillEl.style.background = `linear-gradient(90deg, ${current.color}aa, ${current.color})`;
    requestAnimationFrame(() => { fillEl.style.width = pct + '%'; });
  }
}

/* ── ADD XP ─────────────────────────────────────────────── */
function addXP(amount, sourceEl = null) {
  const oldLevel = getLevelInfo(gameState.xp).current.level;
  gameState.xp += amount;
  const newInfo  = getLevelInfo(gameState.xp);
  saveGameState();
  renderXpBar();

  // Float
  if (sourceEl) spawnXpFloat(amount, sourceEl);

  // Level up?
  if (newInfo.current.level > oldLevel) {
    triggerLevelUp(newInfo.current);
  }

  checkAchievements();
}

/* ── XP FLOAT ───────────────────────────────────────────── */
function spawnXpFloat(amount, el) {
  try {
    const rect  = el.getBoundingClientRect();
    const float = document.createElement('div');
    float.className = 'xp-float' + (amount < 0 ? ' minus' : '');
    float.textContent = (amount > 0 ? '+' : '') + amount + ' XP';
    float.style.left = (rect.left + rect.width / 2 - 20) + 'px';
    float.style.top  = (rect.top - 10) + 'px';
    document.body.appendChild(float);
    setTimeout(() => float.remove(), 1500);
  } catch(e) {}
}

/* ── COMBO — tracking interno apenas para conquistas (sem exibição visual) ── */
function incrementCombo(sourceEl) {
  clearTimeout(comboTimer);
  comboCount++;
  if (comboCount > gameState.maxCombo) {
    gameState.maxCombo = comboCount;
    saveGameState();
  }
  comboTimer = setTimeout(() => { comboCount = 0; }, COMBO_WINDOW_MS);
}

/* ── TASK TOGGLE (função principal, chamada pelo os-app.js) ── */
async function gameToggleTask(taskId, isDone, taskEl, dayLabel, allTasks) {
  /* 1. Animação imediata no checkbox */
  const checkEl = taskEl?.querySelector('.task-check');
  if (checkEl) {
    checkEl.classList.add('checking');
    setTimeout(() => checkEl.classList.remove('checking'), 450);
  }

  /* 2. Animação no card */
  if (taskEl) {
    taskEl.classList.add(isDone ? 'completing' : 'uncompleting');
    setTimeout(() => taskEl.classList.remove(isDone ? 'completing' : 'uncompleting'), 550);
  }

  /* 3. Atualizar DOM imediatamente (sem esperar API) */
  if (isDone) {
    taskEl?.classList.add('done');
    const checkIcon = taskEl?.querySelector('.task-check i');
    if (checkIcon) checkIcon.style.display = 'block';
    playSound('complete');
    addXP(XP_PER_TASK, taskEl);
    gameState.totalDone++;
    incrementCombo(taskEl); // track interno (sem banner visual)
  } else {
    taskEl?.classList.remove('done');
    const checkIcon = taskEl?.querySelector('.task-check i');
    if (checkIcon) checkIcon.style.display = 'none';
    playSound('uncheck');
    addXP(-Math.floor(XP_PER_TASK / 2), taskEl);
    gameState.totalDone = Math.max(0, gameState.totalDone - 1);
  }
  saveGameState();

  /* 4. Atualizar barra de progresso do dia em tempo real */
  updateDayProgressUI(dayLabel, allTasks, taskId, isDone);

  /* 5. Chamar API em background */
  try {
    await fetch(`tables/age_tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: isDone })
    });
  } catch(e) {}

  /* 6. Verificar se o dia está 100% completo */
  checkDayComplete(dayLabel, allTasks, taskId, isDone);
  checkAchievements();
}

/* ── ATUALIZAR BARRA SEM RELOAD ─────────────────────────── */
function updateDayProgressUI(dayLabel, allTasks, changedId, isDoneNow) {
  // Calcular novo total com a tarefa mudada
  const dayTasks = allTasks.filter(t => t.day_label === dayLabel && !t.is_day_placeholder);
  const doneCount = dayTasks.filter(t => {
    if (t.id === changedId) return isDoneNow;
    return t.done === true || t.done === 'true';
  }).length;
  const total = dayTasks.length;
  const pct   = total ? Math.round(doneCount / total * 100) : 0;

  // Atualizar número grande
  const numEl = document.querySelector('.day-prog-num');
  if (numEl) {
    numEl.textContent = pct + '%';
    numEl.style.animation = 'none';
    requestAnimationFrame(() => { numEl.style.animation = ''; });
  }

  // Atualizar XP bar do dia
  const fillEl = document.querySelector('.xp-fill');
  const glowEl = document.querySelector('.xp-glow');
  if (fillEl) {
    fillEl.style.width = pct + '%';
    fillEl.classList.add('levelup-flash');
    setTimeout(() => fillEl.classList.remove('levelup-flash'), 700);
  }
  if (glowEl) glowEl.style.width = pct + '%';

  // Atualizar contagem
  const cntEl = document.querySelector('.day-prog-count');
  if (cntEl) cntEl.textContent = `${doneCount} / ${total} concluídas`;

  // Atualizar % na aba do dia ativo
  updateTabPercent(dayLabel, pct);

  // Atualizar barra de progresso global (página Minhas Tarefas)
  updateGlobalProgressUI(allTasks, changedId, isDoneNow);
}

function updateTabPercent(dayLabel, pct) {
  const tabs = document.querySelectorAll('.day-tab-btn');
  tabs.forEach(tab => {
    const labelEl = tab.querySelector('.day-tab-label');
    const pctEl   = tab.querySelector('.day-tab-pct');
    if (labelEl && labelEl.textContent.trim() === dayLabel.toUpperCase().slice(0,8)) {
      if (pctEl) {
        pctEl.textContent = pct + '%';
        pctEl.style.animation = 'none';
        requestAnimationFrame(() => { pctEl.style.animation = ''; });
      }
      // Ring
      updateTabRing(tab, pct);
    }
  });
}

function updateTabRing(tabEl, pct) {
  const ring = tabEl.querySelector('.day-tab-ring-fill');
  if (!ring) return;
  const r = 17;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  ring.style.strokeDashoffset = offset;
}

function updateGlobalProgressUI(allTasks, changedId, isDoneNow) {
  const realTasks = allTasks.filter(t => !t.is_day_placeholder);
  const doneCount = realTasks.filter(t => {
    if (t.id === changedId) return isDoneNow;
    return t.done === true || t.done === 'true';
  }).length;
  const total = realTasks.length;
  const pct   = total ? Math.round(doneCount / total * 100) : 0;

  const pctEl  = document.getElementById('taskProgressPct');
  const fillEl = document.getElementById('taskProgressFill');
  const glowEl = document.getElementById('taskProgressGlow');
  const cntEl  = document.getElementById('taskProgressCount');
  if (pctEl)  pctEl.textContent  = pct + '%';
  if (fillEl) fillEl.style.width = pct + '%';
  if (glowEl) glowEl.style.width = pct + '%';
  if (cntEl)  cntEl.textContent  = `${doneCount} / ${total} concluídas`;
}

/* ── VERIFICAR DIA COMPLETO ─────────────────────────────── */
function checkDayComplete(dayLabel, allTasks, changedId, isDoneNow) {
  const dayTasks = allTasks.filter(t => t.day_label === dayLabel && !t.is_day_placeholder);
  const doneCount = dayTasks.filter(t => {
    if (t.id === changedId) return isDoneNow;
    return t.done === true || t.done === 'true';
  }).length;
  if (doneCount === dayTasks.length && dayTasks.length > 0 && isDoneNow) {
    gameState.daysCompleted++;
    saveGameState();
    addXP(XP_DAY_BONUS, null);
    setTimeout(() => showMissionComplete(dayLabel, dayTasks.length), 600);
  }
}

/* ── MISSION COMPLETE ───────────────────────────────────── */
function showMissionComplete(dayLabel, taskCount) {
  const overlay = document.getElementById('missionCompleteOverlay');
  const dayEl   = document.getElementById('missionCompleteDay');
  const xpEl    = document.getElementById('missionCompleteXP');
  if (!overlay) return;

  dayEl.textContent = `${dayLabel.toUpperCase()} — 100% ✓`;
  xpEl.textContent  = `+${XP_DAY_BONUS} XP BÔNUS · ${taskCount} TAREFAS CONCLUÍDAS`;
  overlay.style.display = 'flex';
  triggerConfetti();
  playSound('mission');
}

function closeMissionComplete() {
  const overlay = document.getElementById('missionCompleteOverlay');
  if (overlay) overlay.style.display = 'none';
}

/* ── LEVEL UP ───────────────────────────────────────────── */
function triggerLevelUp(levelInfo) {
  const overlay   = document.getElementById('levelupOverlay');
  const subtitleEl = document.getElementById('levelupSubtitle');
  if (!overlay) return;

  subtitleEl.textContent = `NÍVEL ${levelInfo.level} · ${levelInfo.name}`;
  overlay.style.display = 'flex';
  playSound('levelup');
  triggerConfetti(true);
  showAchievementToast('⬆️', 'LEVEL UP!', `Nível ${levelInfo.level} · ${levelInfo.name}`, 0);
  setTimeout(() => { overlay.style.display = 'none'; }, 2800);
}

/* ── CONQUISTAS ─────────────────────────────────────────── */
function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (gameState.unlockedAchievements.includes(a.id)) return;
    if (a.condition(gameState)) {
      gameState.unlockedAchievements.push(a.id);
      addXP(a.xp, null);
      saveGameState();
      setTimeout(() => showAchievementToast(a.icon, a.title, a.desc, a.xp), 800);
    }
  });
}

/* ── ACHIEVEMENT TOAST ──────────────────────────────────── */
let achTimer;
function showAchievementToast(icon, title, desc, xp) {
  const toast  = document.getElementById('achievementToast');
  const iconEl = document.getElementById('achievementIcon');
  const titleEl = document.getElementById('achievementTitle');
  const ptsEl  = document.getElementById('achievementPts');
  if (!toast) return;

  iconEl.textContent  = icon;
  titleEl.textContent = title;
  ptsEl.textContent   = xp > 0 ? `+${xp} XP · ${desc}` : desc;

  toast.classList.add('show');
  clearTimeout(achTimer);
  achTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

/* ── CONFETTI ───────────────────────────────────────────── */
let confettiAnim;
function triggerConfetti(intense = false) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const count = intense ? 180 : 90;
  const colors = ['#ff1a1a','#00aaff','#00ff88','#ffcc00','#cc44ff','#ff6600','#00f5ff'];
  const pieces = Array.from({ length: count }, () => ({
    x:  Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    w:  6 + Math.random() * 8,
    h:  8 + Math.random() * 12,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 6,
    vy: 2 + Math.random() * 5,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 10,
    opacity: 1,
  }));

  cancelAnimationFrame(confettiAnim);
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.1;
      p.rot += p.rotV;
      if (frame > 60) p.opacity -= 0.015;
      if (p.y < canvas.height && p.opacity > 0) alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (alive) confettiAnim = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

/* ── SONS ───────────────────────────────────────────────── */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);

    if (type === 'complete') {
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(820, ctx.currentTime + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'uncheck') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'levelup') {
      // Fanfarra curta
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.18);
        o.start(ctx.currentTime + i * 0.12);
        o.stop(ctx.currentTime + i * 0.12 + 0.18);
      });
      return;
    } else if (type === 'mission') {
      const notes = [523, 784, 1047, 784, 1047];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.15);
        o.start(ctx.currentTime + i * 0.1);
        o.stop(ctx.currentTime + i * 0.1 + 0.15);
      });
      return;
    }
  } catch(e) {}
}

/* ── FINANCE GAMIFICATION ───────────────────────────────── */
function gameFinanceReceived(el) {
  addXP(XP_FINANCE, el);
  gameState.financeDone++;
  saveGameState();
  playSound('complete');
  checkAchievements();
}

/* ── EXPORT para os-app.js ──────────────────────────────── */
window.GAME = {
  init:             initGame,
  toggleTask:       gameToggleTask,
  financeReceived:  gameFinanceReceived,
  addXP,
  renderXpBar,
  checkAchievements,
  closeMissionComplete,
  spawnXpFloat,
};
