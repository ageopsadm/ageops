// ============================================
//   AGE OPS — MISSION CONTROL — APP ENGINE
// ============================================

// STATE
const STATE = {
    tasks: {},
    finance: {},
    activeDay: 'sexta'
};

const TOTAL_FINANCIAL = 23250;
const STORAGE_TASKS   = 'ageops_tasks';
const STORAGE_FINANCE = 'ageops_finance';

// Particle animation frame reference
let particleRAF = null;

// ============================================
// INIT
// ============================================
function init() {
    loadState();
    renderFinancial();
    renderDayContent();
    renderMissionMap();
    initDayTabs();
    updateGlobalProgress();
    updateAllDayTabs();
    startClock();
    initParticles();
}

// ============================================
// STATE PERSISTENCE
// ============================================
function loadState() {
    const savedTasks   = localStorage.getItem(STORAGE_TASKS);
    const savedFinance = localStorage.getItem(STORAGE_FINANCE);
    if (savedTasks)   STATE.tasks   = JSON.parse(savedTasks);
    if (savedFinance) STATE.finance = JSON.parse(savedFinance);
}

function saveState() {
    localStorage.setItem(STORAGE_TASKS,   JSON.stringify(STATE.tasks));
    localStorage.setItem(STORAGE_FINANCE, JSON.stringify(STATE.finance));
}

// ============================================
// FINANCIAL
// ============================================
function renderFinancial() {
    const grid = document.getElementById('financialGrid');
    if (!grid) return;
    grid.innerHTML = '';

    MISSION_DATA.financial.forEach(item => {
        const received = STATE.finance[item.id] || false;
        const card = document.createElement('div');
        card.className = `fin-card ${received ? 'received' : ''}`;
        card.innerHTML = `
            <div class="fin-client">${item.client}</div>
            <div class="fin-value">R$ ${item.value.toLocaleString('pt-BR')}</div>
            <div class="fin-obs">${item.obs}</div>
            <button class="fin-toggle-btn">${received ? '● RECEBIDO' : '○ PENDENTE'}</button>
        `;
        card.addEventListener('click', () => toggleFinancial(item.id));
        grid.appendChild(card);
    });

    updateFinancialProgress();
}

function toggleFinancial(id) {
    STATE.finance[id] = !STATE.finance[id];
    saveState();
    renderFinancial();
    updateGlobalProgress();
    updateAllDayTabs();

    const item = MISSION_DATA.financial.find(f => f.id === id);
    if (STATE.finance[id] && item) {
        showAchievement(`R$ ${item.value.toLocaleString('pt-BR')} de ${item.client} recebido!`);
    }
}

function updateFinancialProgress() {
    const received = MISSION_DATA.financial
        .filter(f => STATE.finance[f.id])
        .reduce((sum, f) => sum + f.value, 0);
    const pct = Math.round((received / TOTAL_FINANCIAL) * 100);

    const bar       = document.getElementById('financialBar');
    const collected = document.getElementById('collectedValue');
    const finPct    = document.getElementById('financialPercent');

    if (bar)       bar.style.width    = `${pct}%`;
    if (collected) collected.textContent = `R$ ${received.toLocaleString('pt-BR')}`;
    if (finPct)    finPct.textContent  = `${pct}%`;
}

// ============================================
// DAY CONTENT
// ============================================
function renderDayContent() {
    const wrap = document.getElementById('dayContentWrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    Object.values(MISSION_DATA.days).forEach(day => {
        const panel = document.createElement('div');
        panel.className = `day-panel ${day.id === STATE.activeDay ? 'active' : ''}`;
        panel.id = `day-${day.id}`;

        const completed = day.tasks.filter(t => STATE.tasks[t.id]).length;
        const total     = day.tasks.length;
        const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

        panel.innerHTML = `
            <div class="day-header">
                <div class="day-focus">
                    <span class="focus-label">FOCO DO DIA</span>
                    <span class="focus-text">${day.focus}</span>
                </div>
                <div class="day-progress-block">
                    <span class="day-prog-percent" id="dayPct-${day.id}">${pct}%</span>
                    <div class="day-prog-right">
                        <div class="day-prog-bar-wrap">
                            <div class="day-prog-bar" id="dayBar-${day.id}" style="width:${pct}%"></div>
                        </div>
                        <span class="day-prog-count" id="dayCount-${day.id}">${completed}/${total} CONCLUÍDOS</span>
                    </div>
                </div>
            </div>
            <div class="schedule-grid">
                <div class="tasks-block">
                    <div class="block-title"><i class="fas fa-crosshairs"></i> OBJETIVOS</div>
                    <div id="tasks-${day.id}">${renderTaskList(day.tasks)}</div>
                </div>
                <div class="schedule-block">
                    <div class="block-title"><i class="fas fa-clock"></i> CRONOGRAMA</div>
                    ${renderSchedule(day.schedule)}
                </div>
            </div>
        `;

        wrap.appendChild(panel);

        panel.querySelectorAll('.task-item').forEach(taskEl => {
            taskEl.addEventListener('click', () => {
                toggleTask(taskEl.dataset.taskid, day.id);
            });
        });
    });
}

function renderTaskList(tasks) {
    return tasks.map(t => {
        const done = STATE.tasks[t.id] || false;
        return `
            <div class="task-item ${done ? 'done' : ''}" data-taskid="${t.id}">
                <div class="task-check"><i class="fas fa-check"></i></div>
                <div class="task-body">
                    <span class="task-label">${t.label}</span>
                    <div class="task-meta">
                        <span class="task-area">${t.area}</span>
                        <span class="task-priority ${t.priority === 'high' ? 'high' : 'med'}">${t.priority === 'high' ? '⚠ ALTA' : '● MÉD'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderSchedule(schedule) {
    return schedule.map(s => `
        <div class="schedule-item">
            <span class="sch-time">${s.time}</span>
            <div class="sch-content">
                <div class="sch-block">${s.block}</div>
                <div class="sch-tasks">${s.tasks}</div>
            </div>
        </div>
    `).join('');
}

// ============================================
// TASK TOGGLE
// ============================================
function toggleTask(taskId, dayId) {
    STATE.tasks[taskId] = !STATE.tasks[taskId];
    saveState();

    const taskEl = document.querySelector(`[data-taskid="${taskId}"]`);
    if (taskEl) taskEl.classList.toggle('done', STATE.tasks[taskId]);

    updateDayProgress(dayId);
    updateGlobalProgress();
    updateAllDayTabs();
    updateMissionMap();

    const dayData = MISSION_DATA.days[dayId];
    const task    = dayData?.tasks.find(t => t.id === taskId);

    if (STATE.tasks[taskId] && task) {
        showAchievement(task.label);

        const allDone = dayData.tasks.every(t => STATE.tasks[t.id]);
        if (allDone) {
            setTimeout(() => showDayComplete(dayData.label), 800);
        }
    }
}

function updateDayProgress(dayId) {
    const day = MISSION_DATA.days[dayId];
    if (!day) return;

    const completed = day.tasks.filter(t => STATE.tasks[t.id]).length;
    const total     = day.tasks.length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

    const pctEl   = document.getElementById(`dayPct-${dayId}`);
    const barEl   = document.getElementById(`dayBar-${dayId}`);
    const countEl = document.getElementById(`dayCount-${dayId}`);

    if (pctEl)   pctEl.textContent   = `${pct}%`;
    if (barEl)   barEl.style.width   = `${pct}%`;
    if (countEl) countEl.textContent = `${completed}/${total} CONCLUÍDOS`;
}

// ============================================
// DAY TABS
// ============================================
function initDayTabs() {
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.addEventListener('click', () => switchDay(tab.dataset.day));
    });
}

function switchDay(dayId) {
    STATE.activeDay = dayId;
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.day === dayId);
    });
    document.querySelectorAll('.day-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `day-${dayId}`);
    });
}

function updateAllDayTabs() {
    Object.values(MISSION_DATA.days).forEach(day => {
        const completed = day.tasks.filter(t => STATE.tasks[t.id]).length;
        const total     = day.tasks.length;
        const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
        const tabProg   = document.getElementById(`tab-${day.id}-prog`);
        if (tabProg) tabProg.textContent = `${pct}%`;
    });
}

// ============================================
// GLOBAL PROGRESS
// ============================================
function updateGlobalProgress() {
    let totalItems     = 0;
    let completedItems = 0;

    Object.values(MISSION_DATA.days).forEach(day => {
        totalItems     += day.tasks.length;
        completedItems += day.tasks.filter(t => STATE.tasks[t.id]).length;
    });

    const finCompleted = MISSION_DATA.financial.filter(f => STATE.finance[f.id]).length;
    const finTotal     = MISSION_DATA.financial.length;
    totalItems     += finTotal;
    completedItems += finCompleted;

    const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const fill    = document.getElementById('globalXpFill');
    const glow    = document.getElementById('globalXpGlow');
    const percent = document.getElementById('globalPercent');
    const done    = document.getElementById('completedCount');
    const total   = document.getElementById('totalCount');

    if (fill)    fill.style.width     = `${pct}%`;
    if (glow)    glow.style.width     = `${pct}%`;
    if (percent) percent.textContent  = `${pct}%`;
    if (done)    done.textContent     = completedItems;
    if (total)   total.textContent   = totalItems;

    updateFinancialProgress();
}

// ============================================
// MISSION MAP
// ============================================
function renderMissionMap() {
    const map = document.getElementById('missionMap');
    if (!map) return;
    map.innerHTML = '';

    MISSION_DATA.weekGoals.forEach(goal => {
        const day       = MISSION_DATA.days[goal.dayKey];
        const completed = day.tasks.filter(t => STATE.tasks[t.id]).length;
        const total     = day.tasks.length;
        const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

        const row = document.createElement('div');
        row.className = 'mission-row';
        row.id = `mission-row-${goal.dayKey}`;
        row.innerHTML = `
            <span class="mission-day-tag">${goal.day}</span>
            <span class="mission-goal">${goal.goal}</span>
            <div class="mission-prog-bar-wrap">
                <div class="mission-prog-bar" id="mmBar-${goal.dayKey}" style="width:${pct}%"></div>
            </div>
            <span class="mission-prog-num" id="mmNum-${goal.dayKey}">${pct}%</span>
        `;
        row.addEventListener('click', () => {
            switchDay(goal.dayKey);
            document.querySelector('.day-tabs').scrollIntoView({ behavior: 'smooth' });
        });
        map.appendChild(row);
    });
}

function updateMissionMap() {
    MISSION_DATA.weekGoals.forEach(goal => {
        const day       = MISSION_DATA.days[goal.dayKey];
        const completed = day.tasks.filter(t => STATE.tasks[t.id]).length;
        const total     = day.tasks.length;
        const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

        const bar = document.getElementById(`mmBar-${goal.dayKey}`);
        const num = document.getElementById(`mmNum-${goal.dayKey}`);
        if (bar) bar.style.width   = `${pct}%`;
        if (num) num.textContent   = `${pct}%`;
    });
}

// ============================================
// ACHIEVEMENT TOAST
// ============================================
let toastTimer = null;

function showAchievement(text) {
    const toast = document.getElementById('achievementToast');
    const sub   = document.getElementById('achSubText');
    if (sub) sub.textContent = text;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ============================================
// DAY COMPLETE OVERLAY
// ============================================
function showDayComplete(dayName) {
    const overlay = document.getElementById('completeOverlay');
    const sub     = document.getElementById('completeSubText');
    if (sub)     sub.textContent = `${dayName} — Todos os objetivos concluídos!`;
    if (overlay) overlay.classList.add('active');
}

// ============================================
// CLOCK
// ============================================
function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');

    const clock   = document.getElementById('systemClock');
    const dateEl  = document.getElementById('systemDate');

    if (clock)  clock.textContent  = `${h}:${m}:${s}`;
    if (dateEl) {
        const day   = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        dateEl.textContent = `${day}/${month}/${now.getFullYear()}`;
    }
}

// ============================================
// PARTICLES — reads CSS variable for color
// ============================================
function getParticleColor() {
    const style = getComputedStyle(document.documentElement);
    const rgb   = style.getPropertyValue('--particle-rgb').trim();
    return rgb || '255, 26, 26';
}

function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    // Cancel previous loop if theme changed
    if (particleRAF) cancelAnimationFrame(particleRAF);

    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    // Fewer particles on mobile for performance
    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 28 : 55;
    const particles = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x:      Math.random() * canvas.width,
            y:      Math.random() * canvas.height,
            vx:     (Math.random() - 0.5) * 0.35,
            vy:     (Math.random() - 0.5) * 0.35,
            radius: Math.random() * 1.4 + 0.4,
            alpha:  Math.random() * 0.45 + 0.1,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const rgb = getParticleColor();

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0)             p.x = canvas.width;
            if (p.x > canvas.width)  p.x = 0;
            if (p.y < 0)             p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`;
            ctx.fill();
        });

        // Connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx   = particles[j].x - particles[i].x;
                const dy   = particles[j].y - particles[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 110) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(${rgb}, ${0.07 * (1 - dist / 110)})`;
                    ctx.lineWidth   = 0.5;
                    ctx.stroke();
                }
            }
        }

        particleRAF = requestAnimationFrame(draw);
    }

    draw();

    window.addEventListener('resize', () => {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// Exposed so theme.js can call it on theme switch
function reinitParticles() {
    initParticles();
}

// ============================================
// BOOT
// ============================================
document.addEventListener('DOMContentLoaded', init);
