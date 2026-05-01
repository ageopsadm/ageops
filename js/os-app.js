/* ============================================================
   AGE OPS — OS-APP.JS  (Main Application Logic)
   ============================================================ */

/* ── NAVIGATION ─────────────────────────────────────────── */
const PAGE_TITLES = {
  dashboard:       'DASHBOARD',
  projects:        'PROJETOS',
  myday:           'MEU DIA',
  mytasks:         'MINHAS TAREFAS',
  myfinance:       'FINANCEIRO',
  team:            'EQUIPE',
  fechamento:      'FECHAMENTO',
  cronograma:      'CRONOGRAMA',
  historico:       'HISTÓRICO — AGE OPS',
  clientes:        'BANCO DE CLIENTES',
  colaboradores:   'COLABORADORES',
  'team-calendar': 'CALENDÁRIO DA EQUIPE',
  gestao:          'GESTÃO DE PROJETOS'
};

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page.toUpperCase();

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  }

  // Lazy load page data
  if (page === 'dashboard')  loadDashboard();
  if (page === 'projects')   loadProjects();
  if (page === 'myday')      loadMyDay();
  if (page === 'mytasks')    loadMyTasks();
  if (page === 'myfinance')  loadMyFinance();
  if (page === 'team')       loadTeam();
  if (page === 'fechamento')  { loadFechamentoList(); showFechEmpty(true); }
  if (page === 'cronograma')  { if(window.SCHED)    window.SCHED.onNavigate(); }
  if (page === 'historico')        { if(window.HIST)     window.HIST.onNavigate(); }
  if (page === 'clientes')         { if(window.CLIENTS)  window.CLIENTS.onNavigate(); }
  if (page === 'colaboradores')    { if(window.TEAM)     window.TEAM.onNavigate(); }
  if (page === 'team-calendar')    { if(window.TEAMCAL)  window.TEAMCAL.onNavigate(); }
  if (page === 'gestao')           { if(window.GESTAO)   window.GESTAO.onNavigate(); }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}

/* ── MODAL HELPERS ──────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/* ── TOAST ──────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, icon = 'fa-check-circle') {
  const t = document.getElementById('toast');
  const ti = t.querySelector('.toast-icon');
  document.getElementById('toastText').textContent = msg;
  ti.className = `fas ${icon} toast-icon`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ── UTILS ──────────────────────────────────────────────── */
function fmtBRL(v) {
  const n = parseFloat(v) || 0;
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(str) {
  if (!str) return '—';
  try {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch(e) { return str; }
}
function fmtDateShort(str) {
  if (!str) return '—';
  try {
    const d = new Date(str + 'T00:00:00');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  } catch(e) { return str; }
}
function getProfitColor(pct) {
  const n = parseFloat(pct) || 0;
  if (n >= 50) return '#00ff88';
  if (n >= 25) return '#ffcc00';
  return '#ff4444';
}
function npsClass(n) {
  if (n >= 9) return 'high';
  if (n >= 7) return 'mid';
  return 'low';
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════ */
let charts = {};

async function loadDashboard() {
  try {
    let projects  = [];
    let histProjs = [];

    /* ── 1. Buscar projetos ativos enriquecidos com fechamentos ── */
    if (window.SYNC) {
      try {
        const syncData = await window.SYNC.getDashboardData();
        projects = syncData.projects || [];
      } catch(syncErr) {
        console.warn('SYNC.getDashboardData falhou, usando fallback:', syncErr);
        const resProj = await fetch('tables/age_projects?limit=300');
        const dataProj = resProj.ok ? await resProj.json() : { data: [] };
        projects = (dataProj.data || []).filter(p => !p.deleted);
      }
    } else {
      const resProj = await fetch('tables/age_projects?limit=300');
      const dataProj = resProj.ok ? await resProj.json() : { data: [] };
      projects = (dataProj.data || []).filter(p => !p.deleted);
    }

    /* ── 2. Buscar histórico com deduplicação por (year, client, project) ── */
    const resHist  = await fetch('tables/age_hist_projects?limit=500');
    const dataHist = resHist.ok ? await resHist.json() : { data: [] };
    const rawHist  = (dataHist.data || []).filter(p => !p.deleted);
    /* Deduplicar: garante que duplicatas no banco não inflam os números */
    const _seenHist = new Map();
    histProjs = rawHist.filter(p => {
      const k = `${parseInt(p.year)||0}|${(p.client_name||'').toLowerCase().trim()}|${(p.project_name||'').toLowerCase().trim()}`;
      if (_seenHist.has(k)) return false;
      _seenHist.set(k, true);
      return true;
    });

    /* ── 3. Renderizar todas as seções ── */
    renderKPIs(projects, histProjs);
    renderHistoricalBanner(histProjs);
    renderCharts(projects);
    renderClientRanking(projects);
    renderHealthGrid(projects);
    renderDiagnostics(projects, histProjs);
    renderHistEvolutionChart(histProjs);
    renderDashHistTopClients(histProjs);
  } catch(e) {
    console.error('Dashboard error:', e);
  }
}

/* ── Banner de contexto histórico no dashboard ── */
function renderHistoricalBanner(histProjs) {
  const el = document.getElementById('dashHistBanner');
  if (!el) return;

  /* Dados reais das planilhas 2021–2026 (fonte verdade) */
  const HD = {
    2021:{ fat:67415,  custo:0,     lucro:67415,  n:12, clients:9,  semCusto:true  },
    2022:{ fat:109042, custo:58835, lucro:50207,  n:25, clients:22, semCusto:false },
    2023:{ fat:210591, custo:97431, lucro:113160, n:28, clients:18, semCusto:false },
    2024:{ fat:162440, custo:77538, lucro:84902,  n:22, clients:17, semCusto:false },
    2025:{ fat:110190, custo:0,     lucro:110190, n:23, clients:18, semCusto:true  },
    2026:{ fat:46200,  custo:19979, lucro:26221,  n:12, clients:12, semCusto:false }
  };

  /* Totais reais: faturamento e lucro só de anos com custo registrado */
  const totalHistRev   = Object.values(HD).reduce((s,y)=>s+y.fat,0);  // 705878
  const totalHistCusto = Object.values(HD).reduce((s,y)=>s+y.custo,0); // 253783
  const totalHistLucro = Object.values(HD).reduce((s,y)=>s+y.lucro,0); // 452095
  /* Usar total da planilha como fonte verdade (122 projetos históricos) */
  const totalHistProj  = Object.values(HD).reduce((s,y)=>s+y.n,0); // = 122
  /* Margem global apenas sobre anos com custo registrado */
  const revComCusto  = Object.entries(HD).filter(([,d])=>!d.semCusto).reduce((s,[,d])=>s+d.fat,0);
  const lucComCusto  = Object.entries(HD).filter(([,d])=>!d.semCusto).reduce((s,[,d])=>s+d.lucro,0);
  const margGlobal   = revComCusto > 0 ? (lucComCusto/revComCusto*100) : 0;

  const fat2024 = HD[2024].fat;
  const fat2025 = HD[2025].fat;
  const fat2026 = HD[2026].fat;

  /* Projeção 2026 (Q1 = 3 meses jan-mar) */
  const proj2026    = Math.round((fat2026 / 3) * 12);
  const recorde2023 = HD[2023].fat;
  const g2526       = fat2024 > 0 ? ((fat2025 - fat2024)/fat2024*100) : 0;

  /* Clientes únicos — usar dados do banco deduplicados ou fallback 73 */
  const clientsSet   = new Set(histProjs.map(p=>(p.client_name||'').toLowerCase().trim()).filter(Boolean));
  const totalClients = clientsSet.size > 10 ? clientsSet.size : 73;

  const fmtK = v => {
    if (v >= 1000000) return 'R$'+Math.round(v/100000)/10+'M';
    if (v >= 1000)    return 'R$'+Math.round(v/1000)+'k';
    return 'R$'+Math.round(v);
  };

  el.innerHTML = `
    <div class="dash-hist-banner-header">
      <span class="dash-hist-banner-title"><i class="fas fa-archive"></i> CONTEXTO HISTÓRICO 2021–2026</span>
      <span class="dash-hist-banner-link" onclick="navigate('historico')" style="cursor:pointer;color:#00aaff;font-size:10px;text-decoration:underline">Ver histórico completo →</span>
    </div>
    <div class="dash-hist-strip">
      <div class="dash-hist-item">
        <span class="dash-hist-label">FATURAMENTO TOTAL</span>
        <span class="dash-hist-val" style="color:#00aaff">${fmtK(totalHistRev)}</span>
        <span class="dash-hist-sub">${totalHistProj} projetos</span>
      </div>
      <div class="dash-hist-item">
        <span class="dash-hist-label">LUCRO (anos c/ custo)</span>
        <span class="dash-hist-val" style="color:#00ff88">${fmtK(lucComCusto)}</span>
        <span class="dash-hist-sub">margem ${margGlobal.toFixed(0)}% (2022–2026)</span>
      </div>
      <div class="dash-hist-item">
        <span class="dash-hist-label">CLIENTES ÚNICOS</span>
        <span class="dash-hist-val" style="color:#cc44ff">${totalClients}</span>
        <span class="dash-hist-sub">2021–2026</span>
      </div>
      <div class="dash-hist-item">
        <span class="dash-hist-label">★ RECORDE (2023)</span>
        <span class="dash-hist-val" style="color:#ffcc00">${fmtK(recorde2023)}</span>
        <span class="dash-hist-sub">28 projetos</span>
      </div>
      <div class="dash-hist-item">
        <span class="dash-hist-label">2025 vs 2024</span>
        <span class="dash-hist-val" style="color:${g2526>=0?'#00ff88':'#ff4444'}">${g2526>=0?'▲':'▼'} ${Math.abs(g2526).toFixed(1)}%</span>
        <span class="dash-hist-sub">${fmtK(fat2025)}</span>
      </div>
      <div class="dash-hist-item">
        <span class="dash-hist-label">PROJEÇÃO 2026</span>
        <span class="dash-hist-val" style="color:${proj2026>recorde2023?'#00ff88':'#ff8800'}">${fmtK(proj2026)}</span>
        <span class="dash-hist-sub">Q1: ${fmtK(fat2026)}</span>
      </div>
    </div>
    <div class="dash-hist-years-row">
      ${Object.entries(HD).map(([y,d]) => {
        const prevFat = HD[parseInt(y)-1] ? HD[parseInt(y)-1].fat : null;
        const g = prevFat ? ((d.fat-prevFat)/prevFat*100) : null;
        const isRec = parseInt(y)===2023;
        const isCur = parseInt(y)===2026;
        return `<div class="dash-hist-year-chip ${isRec?'chip-record':''} ${isCur?'chip-current':''}">
          <span class="chip-year">${y}${isCur?'●':''}</span>
          <span class="chip-val">${fmtK(d.fat)}</span>
          ${g!==null ? `<span class="chip-g" style="color:${g>=0?'#00ff88':'#ff4444'}">${g>=0?'▲':'▼'}${Math.abs(g).toFixed(0)}%</span>` : ''}
          ${d.semCusto ? '<span class="chip-g" style="color:#445566;font-size:8px">s/custo</span>' : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderKPIs(projects, histProjs) {
  histProjs = histProjs || [];

  /* ── Projetos ativos (não cancelados) ── */
  const active = projects.filter(p => p.status !== 'cancelado');

  /* ── Faturamento: soma total_value real do projeto
        Se enriquecido por SYNC (_hasFech), usa fech.total_value; senão usa proj.total_value ── */
  const totalRev = active.reduce((s, p) => {
    const v = parseFloat(p.total_value) || 0;
    return s + v;
  }, 0);

  /* ── Custo real: prioriza custo do fechamento (_hasFech = true → cost já é gastos+imposto) ── */
  const totalCost = active.reduce((s, p) => {
    return s + (parseFloat(p.cost) || 0);
  }, 0);

  /* ── Lucro real: prioriza _profit calculado pelo SYNC (gastos+imposto) ── */
  const totalProfit = active.reduce((s, p) => {
    if (p._profit !== undefined) return s + (parseFloat(p._profit) || 0);
    const val  = parseFloat(p.total_value) || 0;
    const cost = parseFloat(p.cost) || 0;
    return s + Math.max(0, val - cost);
  }, 0);

  const ticket    = active.length > 0 ? totalRev / active.length : 0;
  const avgMargin = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;

  /* ── NPS: apenas projetos com NPS > 0 ── */
  const withNps  = active.filter(p => parseFloat(p.nps) > 0);
  const avgNps   = withNps.length
    ? withNps.reduce((s, p) => s + (parseFloat(p.nps) || 0), 0) / withNps.length
    : 0;

  /* ── Clientes novos ── */
  const newClients = active.filter(p =>
    p.is_new_client === 'true' || p.is_new_client === true
  ).length;

  /* ── Média de faturamento mensal (usa payment_date como data financeira) ── */
  const monthMap2 = {};
  active.forEach(p => {
    const d = p.payment_date || p.project_date;
    if (!d) return;
    const dt  = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    monthMap2[key] = (monthMap2[key] || 0) + (parseFloat(p.total_value) || 0);
  });
  const monthVals  = Object.values(monthMap2);
  const avgMonthly = monthVals.length
    ? monthVals.reduce((s, v) => s + v, 0) / monthVals.length
    : 0;
  const numMonths  = monthVals.length;

  /* ── Atualizar elementos do DOM ── */
  setKPI('kpiRevenue',    fmtBRL(totalRev));
  setKPI('kpiProfit',     fmtBRL(totalProfit));
  setKPI('kpiTicket',     fmtBRL(ticket));
  setKPI('kpiProjects',   active.length);
  setKPI('kpiNps',        avgNps > 0 ? avgNps.toFixed(1) + ' ★' : '—');
  setKPI('kpiNewClients', newClients);
  setKPI('kpiMargin',     avgMargin.toFixed(1) + '%');
  setKPI('kpiCost',       fmtBRL(totalCost));
  setKPI('kpiAvgMonth',   fmtBRL(avgMonthly));

  const subEl = document.getElementById('kpiAvgMonthSub');
  if (subEl) subEl.textContent = `média de ${numMonths} mês${numMonths !== 1 ? 'es' : ''}`;

  /* ── Colorir margem ── */
  const marginEl = document.getElementById('kpiMargin');
  if (marginEl) marginEl.style.color = getProfitColor(avgMargin);
  const profitEl = document.getElementById('kpiProfit');
  if (profitEl) profitEl.style.color = getProfitColor(avgMargin);
}

function setKPI(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderCharts(projects) {
  const active = projects.filter(p => p.status !== 'cancelado');

  /* ── Helper: obter data financeira do projeto ──
     Prioridade: payment_date (data de recebimento) > project_date > created_at */
  function getFinDate(p) {
    const d = p.payment_date || p.project_date || p.created_at;
    if (!d) return null;
    if (typeof d === 'number') return new Date(d);
    return new Date(d + 'T00:00:00');
  }

  /* ── Mapa de faturamento mensal ── */
  const monthMap = {};
  active.forEach(p => {
    const dt = getFinDate(p);
    if (!dt || isNaN(dt)) return;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = (monthMap[key] || 0) + (parseFloat(p.total_value) || 0);
  });

  const months = Object.keys(monthMap).sort();
  const monthLabels = months.map(m => {
    const [y, mo] = m.split('-');
    const ns = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${ns[parseInt(mo) - 1]}/${y.slice(2)}`;
  });

  /* ── Gráfico de faturamento mensal ── */
  destroyChart('chartMonthly');
  const ctxM = document.getElementById('chartMonthly');
  if (ctxM && months.length) {
    const cpColor = getComputedStyle(document.documentElement).getPropertyValue('--c-p').trim() || '#00aaff';
    charts.chartMonthly = new Chart(ctxM, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Faturamento',
          data: months.map(m => monthMap[m]),
          backgroundColor: 'rgba(0,170,255,0.25)',
          borderColor: cpColor,
          borderWidth: 2,
          borderRadius: 4
        }]
      },
      options: chartOptions('Faturamento (R$)')
    });
  }

  /* ── Gráfico de categorias (pizza) ── */
  const catMap = {};
  active.forEach(p => {
    const cat = p.category || 'outros';
    catMap[cat] = (catMap[cat] || 0) + (parseFloat(p.total_value) || 0);
  });
  const catColors = ['#ff1a1a','#00aaff','#cc44ff','#ffcc00','#00ff88','#ff6600','#00f5ff','#ff6688'];
  destroyChart('chartCategory');
  const ctxC = document.getElementById('chartCategory');
  if (ctxC && Object.keys(catMap).length) {
    charts.chartCategory = new Chart(ctxC, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catMap).map(c => c.replace(/_/g,' ').toUpperCase()),
        datasets: [{ data: Object.values(catMap), backgroundColor: catColors, borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#e4eeff', font: { family: 'Share Tech Mono', size: 9 }, padding: 8 } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtBRL(ctx.raw)}` } }
        }
      }
    });
  }

  /* ── Gráfico Lucro vs Custo por mês ── */
  destroyChart('chartProfitCost');
  const ctxPC = document.getElementById('chartProfitCost');
  if (ctxPC && months.length) {
    const profitData = months.map(m => {
      return active
        .filter(p => {
          const dt = getFinDate(p);
          if (!dt || isNaN(dt)) return false;
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` === m;
        })
        .reduce((s, p) => {
          if (p._profit !== undefined) return s + (parseFloat(p._profit) || 0);
          const v = parseFloat(p.total_value) || 0;
          const c = parseFloat(p.cost) || 0;
          return s + Math.max(0, v - c);
        }, 0);
    });
    const costData = months.map(m => {
      return active
        .filter(p => {
          const dt = getFinDate(p);
          if (!dt || isNaN(dt)) return false;
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` === m;
        })
        .reduce((s, p) => s + (parseFloat(p.cost) || 0), 0);
    });
    charts.chartProfitCost = new Chart(ctxPC, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [
          { label: 'Lucro', data: profitData, borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,.1)', fill: true, tension: .4, pointRadius: 3 },
          { label: 'Custo', data: costData,   borderColor: '#ff4444', backgroundColor: 'rgba(255,68,68,.06)',  fill: true, tension: .4, pointRadius: 3 }
        ]
      },
      options: chartOptions('Valor (R$)')
    });
  }

  /* ── Gráfico NPS ── */
  destroyChart('chartNps');
  const ctxN = document.getElementById('chartNps');
  if (ctxN) {
    const npsProjects = active.filter(p => parseFloat(p.nps) > 0).slice(-20);
    if (npsProjects.length) {
      charts.chartNps = new Chart(ctxN, {
        type: 'bar',
        data: {
          labels: npsProjects.map(p => (p.client_name || '?').slice(0, 8)),
          datasets: [{
            label: 'NPS',
            data: npsProjects.map(p => parseFloat(p.nps) || 0),
            backgroundColor: npsProjects.map(p => {
              const n = parseFloat(p.nps) || 0;
              return n >= 9 ? '#00ff88' : n >= 7 ? '#ffcc00' : '#ff4444';
            }),
            borderRadius: 3
          }]
        },
        options: {
          ...chartOptions('NPS'),
          scales: { ...chartOptions('NPS').scales, y: { ...chartOptions('NPS').scales.y, min: 0, max: 10 } }
        }
      });
    }
  }
}

function chartOptions(yLabel = '') {
  const tc = '#6688aa';
  const gc = 'rgba(100,120,160,0.12)';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,.9)',
        titleColor: '#e4eeff',
        bodyColor: '#99bbdd',
        borderColor: 'rgba(100,160,255,.2)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: tc, font: { family:'Share Tech Mono', size:9 } },
        grid: { color: gc },
        border: { color: 'transparent' }
      },
      y: {
        ticks: { color: tc, font: { family:'Share Tech Mono', size:9 } },
        grid: { color: gc },
        border: { color: 'transparent' }
      }
    }
  };
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderClientRanking(projects) {
  const active = projects.filter(p => p.status !== 'cancelado');
  const clientMap = {};
  active.forEach(p => {
    const c = p.client_name || 'Desconhecido';
    if (!clientMap[c]) clientMap[c] = 0;
    clientMap[c] += parseFloat(p.total_value) || 0;
  });
  const sorted = Object.entries(clientMap).sort((a,b) => b[1]-a[1]).slice(0,8);
  const max = sorted[0]?.[1] || 1;
  const el = document.getElementById('clientRanking');
  if (!el) return;
  if (!sorted.length) { el.innerHTML = '<div class="table-loading">Nenhum projeto cadastrado</div>'; return; }
  el.innerHTML = sorted.map(([client, val], i) => `
    <div class="ranking-item" style="flex-direction:column;gap:4px;">
      <div style="display:flex;align-items:center;gap:10px;width:100%">
        <span class="rank-pos ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">#${i+1}</span>
        <span class="rank-client">${client}</span>
        <span class="rank-value">${fmtBRL(val)}</span>
      </div>
      <div class="rank-bar"><div class="rank-bar-fill" style="width:${(val/max*100).toFixed(1)}%"></div></div>
    </div>
  `).join('');
}

function renderHealthGrid(projects) {
  const active = projects.filter(p => p.status !== 'cancelado');
  const totalRev = active.reduce((s,p) => s+(parseFloat(p.total_value)||0), 0);
  const totalCost = active.reduce((s,p) => s+(parseFloat(p.cost)||0), 0);
  const totalProfit = totalRev - totalCost;
  const margin = totalRev ? totalProfit/totalRev*100 : 0;
  const avgNps = active.filter(p=>p.nps>0).length
    ? active.filter(p=>p.nps>0).reduce((s,p)=>s+(parseFloat(p.nps)||0),0)/active.filter(p=>p.nps>0).length : 0;
  const conclPct = active.length ? active.filter(p=>p.status==='concluido').length/active.length*100 : 0;
  const newClientPct = active.length ? active.filter(p=>p.is_new_client==='true'||p.is_new_client===true).length/active.length*100 : 0;

  const items = [
    { label:'MARGEM LÍQUIDA', value: margin.toFixed(1)+'%', pct: margin, thresholds:[40,20] },
    { label:'NPS MÉDIO', value: avgNps.toFixed(1)+'/10', pct: avgNps*10, thresholds:[80,60] },
    { label:'TAXA CONCLUSÃO', value: conclPct.toFixed(1)+'%', pct: conclPct, thresholds:[60,30] },
    { label:'CLIENTES NOVOS', value: newClientPct.toFixed(1)+'%', pct: newClientPct, thresholds:[40,15] }
  ];

  const el = document.getElementById('healthGrid');
  if (!el) return;
  el.innerHTML = items.map(item => {
    const cls = item.pct >= item.thresholds[0] ? 'health-good' : item.pct >= item.thresholds[1] ? 'health-mid' : 'health-bad';
    return `
      <div class="health-item">
        <div class="health-label">${item.label}</div>
        <div class="health-value">${item.value}</div>
        <div class="health-bar-wrap"><div class="health-bar ${cls}" style="width:${Math.min(100,item.pct).toFixed(1)}%"></div></div>
      </div>
    `;
  }).join('');
}

/* ── Gráfico histórico de evolução anual ── */
function renderHistEvolutionChart(histProjs) {
  /* Dados fixos das planilhas — fonte verdade para faturamento anual */
  const HD = [
    { year:2021, fat:67415,  custo:0,      lucro:67415,  semCusto:true  },
    { year:2022, fat:109042, custo:58835,  lucro:50207,  semCusto:false },
    { year:2023, fat:210591, custo:97431,  lucro:113160, semCusto:false },
    { year:2024, fat:162440, custo:77538,  lucro:84902,  semCusto:false },
    { year:2025, fat:110190, custo:0,      lucro:110190, semCusto:true  },
    { year:2026, fat:46200,  custo:19979,  lucro:26221,  semCusto:false }
  ];

  /* Sobrescrever com dados reais do DB quando disponíveis (e não forem falsos 0→100%) */
  const yearData = HD.map(d => {
    const yp = histProjs.filter(p => p.year == d.year);
    if (!yp.length || d.semCusto) return d; /* Usar planilha para anos sem custo */
    const dbRev   = yp.reduce((s,p)=>s+(parseFloat(p.value)||0),0);
    const dbCusto = yp.reduce((s,p)=>s+(parseFloat(p.cost)||0),0);
    const dbLucro = yp.reduce((s,p)=>s+(parseFloat(p.profit)||0),0);
    /* Só substituir se o DB tiver valores consistentes */
    const useDB = dbRev > d.fat * 0.9 && dbRev < d.fat * 1.1; /* Dentro de 10% da planilha */
    return useDB
      ? { ...d, fat: dbRev, custo: dbCusto, lucro: dbLucro }
      : d;
  });

  destroyChart('chartHistEvolution');
  const canvas = document.getElementById('chartHistEvolution');
  if (!canvas) return;

  charts.chartHistEvolution = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: yearData.map(d => d.year),
      datasets: [
        {
          label: 'Faturamento',
          data: yearData.map(d => d.fat),
          backgroundColor: yearData.map(d =>
            d.year===2023 ? 'rgba(255,204,0,0.35)' :
            d.year===2026 ? 'rgba(204,68,255,0.3)' : 'rgba(0,170,255,0.25)'),
          borderColor: yearData.map(d =>
            d.year===2023 ? '#ffcc00' :
            d.year===2026 ? '#cc44ff' : '#00aaff'),
          borderWidth: 2, borderRadius: 5, order: 2
        },
        {
          label: 'Lucro (anos c/ custo)',
          data: yearData.map(d => d.semCusto ? null : d.lucro),
          type: 'line',
          borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.08)',
          borderWidth: 2, pointRadius: 5, pointBackgroundColor: '#00ff88',
          fill: false, tension: 0.3, order: 1,
          spanGaps: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: 'rgba(180,200,220,.8)', font: { family:'Share Tech Mono', size:9 } } },
        tooltip: { callbacks: {
          label: c => {
            if (c.raw === null) return ` ${c.dataset.label}: custo não registrado`;
            return ` ${c.dataset.label}: ${fmtBRL(c.raw)}`;
          }
        }}
      },
      scales: {
        x: { ticks: { color: 'rgba(180,200,220,.7)', font: { family:'Orbitron', size:9 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: 'rgba(180,200,220,.7)', font: { family:'Share Tech Mono', size:9 }, callback: v => 'R$'+Math.round(v/1000)+'k' }, grid: { color: 'rgba(255,255,255,.06)' } }
      }
    }
  });
}

/* ── Top 5 clientes históricos no dashboard ── */
function renderDashHistTopClients(histProjs) {
  const el = document.getElementById('dashHistTopClients');
  if (!el) return;

  /* Top clientes da planilha (fallback se BD vazio) */
  const TOP_FALLBACK = [
    { name: 'JAY P',           value: 243600, count: 27 },
    { name: 'UNIVERSAL MUSIC', value: 105100, count: 5  },
    { name: 'Giana Mello',     value: 96100,  count: 12 },
    { name: 'LOU GARCIA',      value: 86900,  count: 4  },
    { name: 'KG NETWORK',      value: 69550,  count: 6  }
  ];

  let topClients;
  if (histProjs.length > 0) {
    const cMap = {};
    histProjs.forEach(p => {
      const c = p.client_name || '?';
      if (!cMap[c]) cMap[c] = { value:0, count:0 };
      cMap[c].value += parseFloat(p.value)||0;
      cMap[c].count ++;
    });
    topClients = Object.entries(cMap).sort((a,b)=>b[1].value-a[1].value).slice(0,5)
      .map(([name,d]) => ({name, value:d.value, count:d.count}));
  } else {
    topClients = TOP_FALLBACK;
  }

  const max = topClients[0]?.value || 1;
  const medals = ['🥇','🥈','🥉'];

  el.innerHTML = topClients.map((c, i) => `
    <div class="ranking-item" style="flex-direction:column;gap:4px;">
      <div style="display:flex;align-items:center;gap:10px;width:100%">
        <span class="rank-pos ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${medals[i]||`#${i+1}`}</span>
        <span class="rank-client">${c.name}</span>
        <span style="font-size:9px;color:#88aacc;margin-left:auto">${c.count}p</span>
        <span class="rank-value">${fmtBRL(c.value)}</span>
      </div>
      <div class="rank-bar"><div class="rank-bar-fill" style="width:${(c.value/max*100).toFixed(1)}%;background:${i===0?'#ffcc00':i===1?'#aabbcc':'#00aaff'}"></div></div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════
   DIAGNÓSTICO OPERACIONAL — PRODUTORA / AGÊNCIA 5 ANOS
   ══════════════════════════════════════════════════════════ */
function renderDiagnostics(projects, histProjs) {
  histProjs = histProjs || [];
  const listEl     = document.getElementById('diagList');
  const scoreRowEl = document.getElementById('diagScoreRow');
  const tsEl       = document.getElementById('diagTimestamp');
  if (!listEl || !scoreRowEl) return;

  const now = new Date();
  if (tsEl) tsEl.textContent = 'Atualizado às ' + now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

  const active    = projects.filter(p => p.status !== 'cancelado');
  const concluded = projects.filter(p => p.status === 'concluido');
  const pending   = projects.filter(p => p.status === 'pendente');

  const totalRev    = active.reduce((s,p) => s + (parseFloat(p.total_value)||0), 0);
  const totalCost   = active.reduce((s,p) => s + (parseFloat(p.cost)||0), 0);
  const totalProfit = totalRev - totalCost;
  const margin      = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;

  const withNps     = active.filter(p => parseFloat(p.nps) > 0);
  const avgNps      = withNps.length ? withNps.reduce((s,p)=>s+(parseFloat(p.nps)||0),0)/withNps.length : 0;

  const newClientsArr  = active.filter(p => p.is_new_client===true||p.is_new_client==='true');
  const newClientRate  = active.length ? (newClientsArr.length / active.length * 100) : 0;
  const ticket         = active.length ? totalRev / active.length : 0;

  /* Receita por mês */
  const monthRevMap = {};
  active.forEach(p => {
    const d = p.payment_date || p.project_date;
    if (!d) return;
    const dt  = new Date(d + 'T00:00:00');
    const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
    monthRevMap[key] = (monthRevMap[key]||0) + (parseFloat(p.total_value)||0);
  });
  const sortedMonths = Object.keys(monthRevMap).sort();
  const monthVals    = sortedMonths.map(k => monthRevMap[k]);
  const avgMonthly   = monthVals.length ? monthVals.reduce((s,v)=>s+v,0)/monthVals.length : 0;
  const lastThree    = sortedMonths.slice(-3).map(k => monthRevMap[k]);
  const revTrend     = lastThree.length >= 2
    ? ((lastThree[lastThree.length-1] - lastThree[0]) / (lastThree[0]||1) * 100)
    : null;

  /* Projetos por categoria */
  const catMap = {};
  active.forEach(p => { const c=p.category||'outro'; catMap[c]=(catMap[c]||0)+(parseFloat(p.total_value)||0); });

  /* Clientes */
  const clientCount = {};
  active.forEach(p => { const c=p.client_name||''; clientCount[c]=(clientCount[c]||0)+1; });
  const repeatClients = Object.entries(clientCount).filter(([,n])=>n>1);
  const clientsByVal  = Object.keys(clientCount).map(name => ({
    name,
    total: active.filter(p=>p.client_name===name).reduce((s,p)=>s+(parseFloat(p.total_value)||0),0)
  })).sort((a,b)=>b.total-a.total);
  const topClient    = clientsByVal[0] || null;
  const topClientConc= topClient && totalRev > 0 ? (topClient.total/totalRev*100) : 0;

  /* Projetos com margem baixa */
  const lowMarginProjects = active.filter(p => {
    const tv=parseFloat(p.total_value)||0, c=parseFloat(p.cost)||0;
    return tv > 0 && ((tv-c)/tv*100) < 30;
  });

  /* Projetos pendentes há mais de 30 dias */
  const oldPending = pending.filter(p => {
    if (!p.project_date) return false;
    return (now - new Date(p.project_date+'T00:00:00')) / 86400000 > 30;
  });

  /* NPS faltando em projetos concluídos */
  const missingNps = concluded.filter(p => !(parseFloat(p.nps)>0));

  /* Recorrência: projetos recorrentes vs pontuais */
  const recurrentRev = (catMap['producao_recorrente']||0);
  const recurrentPct = totalRev > 0 ? (recurrentRev/totalRev*100) : 0;

  /* Projetos em eventos vs publicidade */
  const eventoRev = (catMap['evento']||0) + (catMap['clipe']||0);
  const publiRev  = (catMap['publicidade']||0) + (catMap['campanha']||0);

  /* ── GERAÇÃO DOS DIAGNÓSTICOS ESTRATÉGICOS ── */
  const diags = [];

  /* ─ 1. MARGEM LÍQUIDA ─ */
  if (margin < 20) {
    diags.push({ level:'critical', icon:'fa-fire', title:'Margem crítica — revisão urgente',
      msg:`Margem de <b>${margin.toFixed(1)}%</b>. Uma produtora saudável deve operar acima de 35–40%. Cada projeto abaixo desse patamar corrói o caixa. Revise precificação, renegocie fornecedores e elimine custos ocultos (horas não cobradas, equipamentos subutilizados). Com 5 anos de mercado, vocês têm credibilidade para aumentar o preço — cobrem pelo portfólio, não pelo custo.` });
  } else if (margin < 38) {
    diags.push({ level:'warn', icon:'fa-exclamation-triangle', title:'Margem abaixo do potencial',
      msg:`Margem de <b>${margin.toFixed(1)}%</b>. Saudável, mas uma agência com 5 anos de história e portfólio consolidado deveria estar em 45–55%. O gap provavelmente está em negociações conservadoras e projetos abaixo do valor justo. Aumente tabela de preços gradualmente — 10–15% ao ano é o padrão de mercado.` });
  } else {
    diags.push({ level:'ok', icon:'fa-shield-alt', title:'Margem sólida',
      msg:`Margem de <b>${margin.toFixed(1)}%</b> — dentro do range de excelência para produtoras premium. Mantenha o controle fino de custos variáveis e proteja essa margem ao crescer. Cuidado: crescimento sem controle corrói margem.` });
  }

  /* ─ 2. MÉDIA MENSAL vs META DE CRESCIMENTO ─ */
  if (avgMonthly > 0) {
    const meta5anos = 30000; // Produtora madura: R$30k/mês mínimo
    const metaIdeal = 60000; // Com escala: R$60k/mês
    if (avgMonthly < meta5anos) {
      diags.push({ level:'critical', icon:'fa-chart-bar', title:'Faturamento mensal abaixo do potencial',
        msg:`Média mensal de <b>${fmtBRL(avgMonthly)}</b>. Para uma produtora/agência com 5 anos de mercado, o benchmark saudável é <b>R$ 30.000–60.000/mês</b>. Vocês estão deixando dinheiro na mesa. Estratégias prioritárias: (1) lance pacotes mensais de gestão de redes/conteúdo, (2) crie um modelo de retainer com os melhores clientes, (3) aumente o preço de projetos pontuais para financiar o crescimento.` });
    } else if (avgMonthly < metaIdeal) {
      diags.push({ level:'warn', icon:'fa-chart-bar', title:'Faturamento mensal em crescimento',
        msg:`Média de <b>${fmtBRL(avgMonthly)}/mês</b>. No caminho certo, mas há espaço. Para chegar a R$ 60k/mês sem dobrar a equipe: crie um produto de conteúdo recorrente, lance um plano de gestão de redes por R$ 3–5k/mês por cliente e feche 8–10 clientes fixos. Receita previsível é o segredo do crescimento sustentável.` });
    } else {
      diags.push({ level:'ok', icon:'fa-rocket', title:'Faturamento mensal forte',
        msg:`Média de <b>${fmtBRL(avgMonthly)}/mês</b> — parabéns! Agora é hora de escalar sem perder qualidade. Considere formalizar os processos, contratar um gestor de projetos e criar um segundo pilar de receita (ex: cursos, licenciamento de conteúdo, white-label para outras agências).` });
    }
  }

  /* ─ 3. TENDÊNCIA RECENTE ─ */
  if (revTrend !== null) {
    if (revTrend > 20) {
      diags.push({ level:'ok', icon:'fa-arrow-trend-up', title:`Crescimento acelerado (+${revTrend.toFixed(0)}%)`,
        msg:`Faturamento cresceu <b>+${revTrend.toFixed(1)}%</b> nos últimos meses. Ritmo excelente — garanta que a operação acompanhe: processos documentados, equipe dimensionada e qualidade preservada. Crescimento rápido sem estrutura vira gargalo em 6 meses.` });
    } else if (revTrend > 0) {
      diags.push({ level:'ok', icon:'fa-trending-up', title:`Crescimento sólido (+${revTrend.toFixed(0)}%)`,
        msg:`Crescimento de <b>+${revTrend.toFixed(1)}%</b>. Consistente. Acelere investindo em prospecção ativa: 1 reunião comercial por dia gera em média 2–3 novos projetos por mês. Indique clientes atuais satisfeitos como fonte de indicação — tem custo zero.` });
    } else if (revTrend > -15) {
      diags.push({ level:'warn', icon:'fa-minus-circle', title:'Faturamento estagnado',
        msg:`Variação de <b>${revTrend.toFixed(1)}%</b> nos últimos meses. Estabilidade conforta, mas para uma agência que quer crescer, é sinal de atenção. Causa mais comum: dependência de projetos pontuais sem pipeline ativo. Resolução: crie uma rotina comercial com metas semanais de prospecção e ative os clientes antigos com um novo serviço.` });
    } else {
      diags.push({ level:'critical', icon:'fa-arrow-trend-down', title:'Queda no faturamento — ação imediata',
        msg:`Queda de <b>${Math.abs(revTrend).toFixed(1)}%</b>. Risco real de caixa negativo. Ações de curto prazo: (1) entre em contato hoje com os 5 melhores clientes e ofereça algo novo, (2) lance uma promoção de janeira/conteúdo mensal com desconto de entrada, (3) feche todos os projetos em aberto, (4) revise despesas fixas e corte o desnecessário. Não espere — queda sustentada é difícil de reverter.` });
    }
  }

  /* ─ 4. RECEITA RECORRENTE ─ */
  if (recurrentPct < 15 && active.length > 3) {
    diags.push({ level:'critical', icon:'fa-sync', title:'Falta receita previsível — maior risco do negócio',
      msg:`Apenas <b>${recurrentPct.toFixed(0)}%</b> do faturamento vem de contratos recorrentes. Esse é o maior problema de agências: viver de projeto em projeto cria ansiedade financeira e impossibilita planejamento. Com 5 anos de clientes, vocês têm relacionamento para propor retainers. Lance um "Pacote Mensal AGE" — gestão de conteúdo, cobertura mensal ou consultoria — entre R$ 2.000 e R$ 8.000/mês por cliente. 5 clientes fixos = R$ 10–40k garantidos todo mês.` });
  } else if (recurrentPct < 35) {
    diags.push({ level:'warn', icon:'fa-sync', title:'Receita recorrente baixa para o potencial',
      msg:`<b>${recurrentPct.toFixed(0)}%</b> de receita recorrente. O ideal para agências maduras é 40–60%. Cada novo projeto pontual que você fechar, ofereça um plano de continuidade (pós-produção, gestão de redes, relatório mensal). Transforme entregas em relacionamentos contínuos.` });
  } else {
    diags.push({ level:'ok', icon:'fa-sync', title:'Boa base de receita recorrente',
      msg:`<b>${recurrentPct.toFixed(0)}%</b> de receita recorrente — ótimo! Base previsível é o que separa agências que crescem das que sobrevivem. Continue expandindo os contratos mensais e invista na qualidade desses clientes para aumentar o LTV (valor ao longo do tempo).` });
  }

  /* ─ 5. CONCENTRAÇÃO DE CLIENTE ─ */
  if (topClient && totalRev > 0) {
    if (topClientConc > 45) {
      diags.push({ level:'critical', icon:'fa-exclamation-circle', title:`Dependência perigosa: ${topClient.name.toUpperCase()}`,
        msg:`<b>${topClient.name}</b> representa <b>${topClientConc.toFixed(0)}%</b> do faturamento. Se esse cliente pausar ou cancelar, a empresa entra em colapso financeiro imediato. Regra de ouro: nenhum cliente deve passar de 25–30% da receita. Diversifique agora — meta de 3 novos clientes por mês até equilibrar o portfólio.` });
    } else if (topClientConc > 30) {
      diags.push({ level:'warn', icon:'fa-user-tie', title:'Carteira concentrada — atenção',
        msg:`<b>${topClient.name}</b> representa <b>${topClientConc.toFixed(0)}%</b> da receita. Zona de risco. Aproveite o bom relacionamento com ele para pedir indicações ativas — clientes satisfeitos indicam quando você pede diretamente. "Você conhece alguém que poderia se beneficiar do nosso trabalho?" É a pergunta que custa zero e gera muito.` });
    } else {
      diags.push({ level:'ok', icon:'fa-users', title:'Carteira bem distribuída',
        msg:`Boa diversificação — maior cliente com <b>${topClientConc.toFixed(0)}%</b> da receita. Essa resiliência é um ativo competitivo. Mantenha o equilíbrio à medida que crescer: novas contas grandes não devem ultrapassar 25% do total.` });
    }
  }

  /* ─ 6. NPS ─ */
  if (avgNps === 0) {
    diags.push({ level:'warn', icon:'fa-star', title:'NPS não coletado — dado estratégico perdido',
      msg:`Nenhum projeto com NPS registrado. Você está voando às cegas em relação à satisfação dos clientes. Crie um processo simples: após cada entrega, envie uma mensagem de WhatsApp perguntando "De 0 a 10, quanto você indicaria nossa produtora?" + uma pergunta aberta. É o dado mais valioso que você pode ter para melhorar e fechar novos contratos (clientes com NPS 9–10 indicam espontaneamente).` });
  } else if (avgNps < 7) {
    diags.push({ level:'critical', icon:'fa-star', title:'NPS baixo — clientes insatisfeitos',
      msg:`NPS de <b>${avgNps.toFixed(1)}</b>. Clientes abaixo de 7 não renovam e não indicam — pior ainda, podem falar mal. Investigue os projetos com nota baixa: foi prazo? Qualidade? Comunicação? Resolva na raiz. Uma ligação de follow-up pós-entrega custa 10 minutos e pode salvar o relacionamento.` });
  } else if (avgNps < 9) {
    diags.push({ level:'warn', icon:'fa-star-half-alt', title:'NPS neutro — potencial de fidelização não explorado',
      msg:`NPS de <b>${avgNps.toFixed(1)}</b>. Clientes entre 7–8 são neutros: não vão embora, mas também não indicam. O que falta para virar 9 ou 10? Geralmente é um pequeno gesto além do contratado: um vídeo extra, uma entrega antecipada, um relatório surpresa. "Surpreender" o cliente uma vez por projeto constrói fidelidade duradoura.` });
  } else {
    diags.push({ level:'ok', icon:'fa-star', title:'NPS excelente — motor de crescimento orgânico',
      msg:`NPS de <b>${avgNps.toFixed(1)}</b> — zona promotora! Seus clientes são fãs. Agora monetize isso: crie um programa de indicação formal (ex: bônus ou desconto para cada cliente indicado que fechar), peça depoimentos em vídeo e publique cases no Instagram/LinkedIn. Sua melhor equipe de vendas já é sua carteira atual.` });
  }

  /* ─ 7. TICKET MÉDIO ─ */
  if (ticket > 0 && ticket < 2000) {
    diags.push({ level:'critical', icon:'fa-tag', title:'Ticket médio muito baixo — revise a precificação',
      msg:`Ticket de <b>${fmtBRL(ticket)}</b>. Para uma produtora de audiovisual com 5 anos, esse valor está abaixo do mercado. Projetos nessa faixa raramente cobrem os custos reais (tempo de equipe, equipamento, deslocamento, pós-produção). Calcule o custo real por hora e multiplique por 3 para ter uma margem saudável. Aumente os preços — clientes que valorizam qualidade não cancelam por 20–30% a mais.` });
  } else if (ticket < 3500) {
    diags.push({ level:'warn', icon:'fa-tag', title:'Ticket médio com espaço para crescer',
      msg:`Ticket de <b>${fmtBRL(ticket)}</b>. Razoável, mas há potencial. Estratégias para aumentar: (1) crie pacotes de valor agregado (ex: "Content Day Premium" com edição estendida + cortes para redes), (2) ofereça upsell de direitos de uso prolongado, (3) posicione projetos como "investimento em marca" — clientes que entendem o retorno pagam mais sem resistência.` });
  } else {
    diags.push({ level:'ok', icon:'fa-tag', title:'Ticket médio competitivo',
      msg:`Ticket de <b>${fmtBRL(ticket)}</b> — bom posicionamento. Você está cobrando pelo valor, não pela hora. Mantenha essa disciplina de precificação e documente os resultados gerados para os clientes — ROI comprovado é o argumento mais forte para renovação e aumento de contrato.` });
  }

  /* ─ 8. PROJETOS PENDENTES PARADOS ─ */
  if (oldPending.length > 0) {
    const names = oldPending.map(p=>p.client_name||'?').slice(0,3).join(', ');
    diags.push({ level:'warn', icon:'fa-clock', title:`${oldPending.length} projeto(s) parado(s) há +30 dias`,
      msg:`<b>${names}</b> estão como "Pendente" há mais de um mês. Projetos em limbo consomem energia mental sem gerar receita. Defina um prazo limite: entre em contato hoje, e se não houver resposta em 5 dias, arquive e libere o espaço na agenda. Pipeline limpo é pipeline eficiente.` });
  }

  /* ─ 9. NPS AUSENTE EM ENTREGAS ─ */
  if (missingNps.length > 2) {
    diags.push({ level:'warn', icon:'fa-question-circle', title:`${missingNps.length} entregas sem avaliação`,
      msg:`<b>${missingNps.length} projetos</b> concluídos sem NPS registrado. Você está perdendo dados que poderiam ser usados para melhorar processos, fechar novos contratos e identificar clientes promotores. Crie um ritual de pós-entrega: mensagem no WhatsApp + nota de 0 a 10 + "o que poderíamos ter feito melhor?". Simples e valioso.` });
  }

  /* ─ 10. CLIENTES RECORRENTES ─ */
  if (repeatClients.length >= 3) {
    const names = repeatClients.slice(0,3).map(([n])=>n).join(', ');
    diags.push({ level:'ok', icon:'fa-heart', title:`${repeatClients.length} clientes voltaram — retenção forte`,
      msg:`<b>${names}</b> e outros já fizeram múltiplos projetos com vocês. Isso é seu maior ativo. Agora é hora de formalizar: proponha um contrato anual com desconto de fidelidade para os 3–5 maiores. Receita garantida no longo prazo vale mais que qualquer campanha de marketing.` });
  } else if (repeatClients.length > 0) {
    diags.push({ level:'warn', icon:'fa-redo', title:'Poucos clientes retornando',
      msg:`Apenas <b>${repeatClients.length} cliente(s)</b> retornou para um segundo projeto. Em uma produtora saudável, 40–50% dos projetos devem ser de clientes recorrentes. Crie um plano de reativação: mande um portfólio atualizado para ex-clientes que sumiram. "Olha o que fizemos recentemente — tem algo que podemos fazer por você?" — simples e eficaz.` });
  }

  /* ─ 11. DIVERSIFICAÇÃO DE SERVIÇOS ─ */
  const numCats = Object.keys(catMap).length;
  if (numCats <= 2 && active.length > 5) {
    diags.push({ level:'warn', icon:'fa-puzzle-piece', title:'Portfólio de serviços concentrado',
      msg:`A maioria dos projetos está em apenas <b>${numCats} categoria(s)</b>. Uma produtora resiliente tem pelo menos 3–4 tipos de serviço. Sugestão: se vocês dominam eventos, adicionem "gestão de conteúdo mensal" (recorrente), "produção de clipes" (aspiracional) e "campanhas de publicidade" (alto ticket). Diversificar reduz risco e abre novos mercados.` });
  } else if (numCats >= 4) {
    diags.push({ level:'ok', icon:'fa-puzzle-piece', title:'Portfólio de serviços diversificado',
      msg:`<b>${numCats} tipos de serviço</b> no portfólio — boa diversificação. Isso protege contra sazonalidade e abre múltiplos canais de venda. Agora o desafio é manter qualidade em todos. Avalie quais categorias têm melhor margem e direcione mais energia para elas.` });
  }

  /* ─ 12. PERSPECTIVA DE CRESCIMENTO COM BASE NO HISTÓRICO REAL ─ */
  const histRev2022 = 109042, histRev2023 = 210591, histRev2024 = 162440;
  const histRev2025 = 110190, histRev2026Q1 = 46200;
  const histTotalRev = histProjs.reduce((s,p)=>s+(parseFloat(p.value)||0),0) || 705878;
  const histTotalN   = histProjs.length || 122;
  const histClients  = new Set(histProjs.map(p=>p.client_name).filter(Boolean)).size || 73;
  const proj2026     = Math.round((histRev2026Q1 / 3) * 12);
  const queda2325    = (((histRev2025 - histRev2023) / histRev2023) * 100);
  const g2024        = (((histRev2024 - histRev2023) / histRev2023) * 100);
  const g2025        = (((histRev2025 - histRev2024) / histRev2024) * 100);

  if (histProjs.length > 0 || active.length >= 0) {
    diags.push({ level: queda2325 < -20 ? 'warn' : 'ok', icon:'fa-seedling',
      title:`Histórico: R$${histTotalRev.toLocaleString('pt-BR')} em ${histTotalN} projetos — meta: superar 2023`,
      msg:`A AGE faturou <b>R$${histTotalRev.toLocaleString('pt-BR')}</b> em <b>${histTotalN} projetos</b> com <b>${histClients} clientes únicos</b> (2021–2026). Recorde: <b>2023 com R$210.591</b>. Queda: 2024 (${g2024.toFixed(1)}%) e 2025 (${g2025.toFixed(1)}%). Q1/2026 projeta <b>~R$${proj2026.toLocaleString('pt-BR')}/ano</b>. Estratégia: (1) <b>Reativar ${histClients} clientes da base</b> — potencial R$50–100k sem custo de aquisição; (2) <b>Contrato recorrente com JAY P</b> (R$243.600 histórico); (3) <b>Meta R$17.600/mês</b> para superar 2023.` });
  }

  /* ── SCORE GERAL (0–100) ── */
  let score = 50;
  diags.forEach(d => {
    if (d.level === 'ok')       score += 7;
    if (d.level === 'warn')     score -= 5;
    if (d.level === 'critical') score -= 13;
  });
  score = Math.max(0, Math.min(100, score));

  const scoreColor = score >= 72 ? '#00ff88' : score >= 48 ? '#ffcc00' : '#ff4444';
  const scoreLbl   = score >= 82 ? 'EXCELENTE' : score >= 65 ? 'BOM' : score >= 48 ? 'ATENÇÃO' : score >= 28 ? 'CRÍTICO' : 'EMERGÊNCIA';
  const scoreIcon  = score >= 72 ? 'fa-check-circle' : score >= 48 ? 'fa-exclamation-triangle' : 'fa-fire';

  const okCount   = diags.filter(d=>d.level==='ok').length;
  const warnCount = diags.filter(d=>d.level==='warn').length;
  const critCount = diags.filter(d=>d.level==='critical').length;

  scoreRowEl.innerHTML = `
    <div class="diag-score-main">
      <div class="diag-score-ring" style="--sc:${scoreColor}">
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="7"/>
          <circle cx="40" cy="40" r="34" fill="none" stroke="${scoreColor}" stroke-width="7"
                  stroke-dasharray="${(score/100*213.6).toFixed(1)} 213.6"
                  stroke-dashoffset="0" stroke-linecap="round"
                  transform="rotate(-90 40 40)"
                  style="filter:drop-shadow(0 0 6px ${scoreColor})"/>
        </svg>
        <div class="diag-score-val" style="color:${scoreColor}">${score}</div>
      </div>
      <div class="diag-score-info">
        <div class="diag-score-label" style="color:${scoreColor}"><i class="fas ${scoreIcon}"></i> ${scoreLbl}</div>
        <div class="diag-score-desc">Análise estratégica baseada em <b>${diags.length} indicadores</b> — produtora/agência 5 anos</div>
        <div class="diag-score-counters">
          <span class="diag-cnt ok"><i class="fas fa-check-circle"></i> ${okCount} positivo${okCount!==1?'s':''}</span>
          <span class="diag-cnt warn"><i class="fas fa-exclamation-triangle"></i> ${warnCount} atenção</span>
          <span class="diag-cnt crit"><i class="fas fa-fire"></i> ${critCount} crítico${critCount!==1?'s':''}</span>
        </div>
      </div>
    </div>`;

  /* ── RENDERIZAR CARDS ── críticos > avisos > ok */
  const sorted = [
    ...diags.filter(d=>d.level==='critical'),
    ...diags.filter(d=>d.level==='warn'),
    ...diags.filter(d=>d.level==='ok'),
  ];
  listEl.innerHTML = sorted.map(d => `
    <div class="diag-card diag-${d.level}">
      <div class="diag-card-icon"><i class="fas ${d.icon}"></i></div>
      <div class="diag-card-body">
        <div class="diag-card-title">${d.title}</div>
        <div class="diag-card-msg">${d.msg}</div>
      </div>
      <div class="diag-card-badge diag-badge-${d.level}">${d.level==='critical'?'CRÍTICO':d.level==='warn'?'ATENÇÃO':'OK'}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════════
   PROJECTS (SPREADSHEET)
   Integração total com Dashboard: qualquer alteração aqui
   dispara loadDashboard() e SYNC automaticamente.
   Ordenação padrão: payment_date DESC (mais recente → topo)
   conforme planilha 2026.
   ══════════════════════════════════════════════════════════ */
let _projectsCache       = [];
let _projectsAllCache    = [];          // cache sem filtros (para KPIs totais do ano)
let _projectsSortField   = 'payment_date';
let _projectsSortDir     = 'desc';

/* ── Segmentos 2026 (da planilha real) ── */
const PROJ_2026_SEGMENTS = {
  'Yuri':             'Moda',
  'Thadeu Meneghini': 'Videoclipe',
  'Irmas Lira':       'Videoclipe',
  'Bill':             'Videoclipe',
  'Thiago sub':       'Videoclipe',
  'Nicoli':           'Publicidade',
  'Alex Marques':     'Publicidade',
  'Talita Perosa':    'Ao Vivo',
  'Viezes':           'Eventos',
  'Marcella':         'Eventos',
  'YURI':             'Moda'
};

/* ── Meses abreviados ── */
const MONTH_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* ── Limpar filtros ── */
function clearProjectFilters() {
  const el = id => document.getElementById(id);
  if (el('filterCategory'))  el('filterCategory').value  = '';
  if (el('filterStatus'))    el('filterStatus').value    = '';
  if (el('filterMonth'))     el('filterMonth').value     = '';
  if (el('searchProjects'))  el('searchProjects').value  = '';
  loadProjects();
}

/* ── Ordenação por coluna ── */
function sortProjects(field) {
  if (_projectsSortField === field) {
    _projectsSortDir = _projectsSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _projectsSortField = field;
    _projectsSortDir   = 'desc';
  }
  _updateSortIcons();
  renderProjectsFromCache();
}

function _updateSortIcons() {
  const iDate = document.getElementById('sortIconDate');
  const iVal  = document.getElementById('sortIconVal');
  if (iDate) {
    iDate.className = _projectsSortField === 'payment_date'
      ? (_projectsSortDir === 'desc' ? 'fas fa-sort-amount-down' : 'fas fa-sort-amount-up')
      : 'fas fa-sort';
    iDate.style.color = _projectsSortField === 'payment_date' ? 'var(--c-p)' : '';
    iDate.style.opacity = _projectsSortField === 'payment_date' ? '1' : '.5';
  }
  if (iVal) {
    iVal.className = _projectsSortField === 'total_value'
      ? (_projectsSortDir === 'desc' ? 'fas fa-sort-amount-down' : 'fas fa-sort-amount-up')
      : 'fas fa-sort';
    iVal.style.color = _projectsSortField === 'total_value' ? 'var(--c-p)' : '';
    iVal.style.opacity = _projectsSortField === 'total_value' ? '1' : '.5';
  }
}

/* ── Carregar projetos do banco ── */
async function loadProjects() {
  const cat    = document.getElementById('filterCategory')?.value  || '';
  const status = document.getElementById('filterStatus')?.value    || '';
  const month  = document.getElementById('filterMonth')?.value     || '';
  const search = (document.getElementById('searchProjects')?.value || '').toLowerCase().trim();

  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="11" class="table-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>`;

  try {
    /* Enriquecer via SYNC para pegar custos reais do fechamento */
    let allRows = [];
    if (window.SYNC) {
      try {
        const sd = await window.SYNC.getDashboardData();
        allRows = (sd.projects || []).filter(p => !p.deleted);
      } catch(e) {
        const res = await fetch('tables/age_projects?limit=300');
        const d   = res.ok ? await res.json() : { data: [] };
        allRows   = (d.data || []).filter(p => !p.deleted);
      }
    } else {
      const res  = await fetch('tables/age_projects?limit=300');
      const data = res.ok ? await res.json() : { data: [] };
      allRows    = (data.data || []).filter(p => !p.deleted);
    }

    /* Usar custo enriquecido do SYNC quando disponível */
    allRows = allRows.map(p => ({
      ...p,
      cost:        p._hasFech ? p.cost        : (parseFloat(p.cost)       || 0),
      total_value: p._hasFech ? p.total_value : (parseFloat(p.total_value)|| 0),
      /* Segmento fallback da planilha 2026 */
      segment: p.segment || PROJ_2026_SEGMENTS[p.client_name] || ''
    }));

    /* Cache sem filtros (para KPIs do ano inteiro) */
    _projectsAllCache = allRows;

    /* Aplicar filtros */
    let rows = [...allRows];
    if (cat)    rows = rows.filter(p => p.category === cat);
    if (status) rows = rows.filter(p => p.status   === status);
    if (month) {
      rows = rows.filter(p => {
        const d = p.payment_date || p.project_date || '';
        if (!d) return false;
        return parseInt(d.substring(5, 7)) === parseInt(month);
      });
    }
    if (search) {
      rows = rows.filter(p =>
        (p.client_name   || '').toLowerCase().includes(search) ||
        (p.project_name  || '').toLowerCase().includes(search) ||
        (p.segment       || '').toLowerCase().includes(search) ||
        (p.category      || '').toLowerCase().includes(search)
      );
    }

    _projectsCache = rows;
    _updateSortIcons();
    renderProjectsFromCache();
    renderProjectKpis(_projectsAllCache);   /* ← KPIs sempre do conjunto total */
    renderProjects2026Panel(_projectsAllCache); /* ← painel mensal 2026 */

  } catch(e) {
    console.error('loadProjects error:', e);
    tbody.innerHTML = `<tr><td colspan="11" class="table-loading">Erro ao carregar projetos.</td></tr>`;
  }
}

/* ── Renderizar do cache (com ordenação) ── */
function renderProjectsFromCache() {
  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;

  let rows = [..._projectsCache];

  /* Ordenação principal: payment_date DESC por padrão (planilha 2026) */
  rows.sort((a, b) => {
    let va, vb;
    if (_projectsSortField === 'payment_date') {
      /* Projetos sem data ficam no fim */
      const da = a.payment_date || a.project_date || '';
      const db = b.payment_date || b.project_date || '';
      va = da ? new Date(da) : new Date('2000-01-01');
      vb = db ? new Date(db) : new Date('2000-01-01');
    } else if (_projectsSortField === 'total_value') {
      va = parseFloat(a.total_value) || 0;
      vb = parseFloat(b.total_value) || 0;
    } else {
      va = a[_projectsSortField] || '';
      vb = b[_projectsSortField] || '';
    }
    if (_projectsSortDir === 'asc') return va > vb ? 1 : -1;
    return va < vb ? 1 : -1;
  });

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-loading">Nenhum projeto encontrado. Clique em "+ Novo Projeto" ou ajuste os filtros.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(p => renderProjectRow(p)).join('');
}

/* ── KPIs mini no topo da página de projetos ── */
function renderProjectKpis(rows) {
  const active  = rows.filter(p => p.status !== 'cancelado');
  const totFat  = active.reduce((s,p) => s + (parseFloat(p.total_value)||0), 0);
  const totCost = active.reduce((s,p) => s + (parseFloat(p.cost)||0), 0);
  const totPro  = totFat - totCost;
  const margin  = totFat > 0 ? (totPro/totFat*100) : 0;
  const ticket  = active.length > 0 ? totFat/active.length : 0;
  const npsRows = active.filter(p => parseFloat(p.nps)>0);
  const avgNps  = npsRows.length ? npsRows.reduce((s,p)=>s+(parseFloat(p.nps)||0),0)/npsRows.length : 0;
  const novos   = active.filter(p => p.is_new_client===true||p.is_new_client==='true').length;

  const set = (id, val, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    if (color) el.style.color = color;
  };

  set('pkFat',    fmtBRL(totFat));
  set('pkCost',   fmtBRL(totCost),  '#ff9944');
  set('pkProfit', fmtBRL(totPro),   totPro >= 0 ? '#00ff88' : '#ff4444');
  set('pkMargin', margin.toFixed(1)+'%', getProfitColor(margin));
  set('pkN',      active.length,    '#cc44ff');
  set('pkNps',    avgNps > 0 ? avgNps.toFixed(1)+' ★' : '—', '#ffcc00');
  set('pkNew',    novos,            '#ff6600');
  set('pkTicket', fmtBRL(ticket));

  /* Indicador de sync */
  const ss = document.getElementById('projSyncStatus');
  if (ss) {
    ss.innerHTML = `<i class="fas fa-circle" style="font-size:6px;margin-right:4px;color:#00ff88"></i><span style="color:#00ff88">LIVE — ${active.length} proj</span>`;
  }
}

/* ── Painel mensal 2026 (mini bar chart) ── */
function renderProjects2026Panel(rows) {
  const barEl   = document.getElementById('proj2026Monthly');
  const lblEl   = document.getElementById('proj2026MonthLabels');
  if (!barEl || !lblEl) return;

  /* Dados reais planilha 2026 (fallback se banco vazio)
     Jan: YURI muito longe (10.000)
     Fev: Marcella miss brasil (3.600)
     Mar: Nicoli(9.400) + Alex Marques(3.000) + Talita Perosa(5.000) + Thadeu Ao Vivo(5.000) + Viezes(2.700) = 25.100
     Abr: 5x Content day × R$1.500 = 7.500
     Total: R$46.200 ✓ */
  const PLAN_2026 = {
    1: 10000,
    2: 3600,
    3: 25100,
    4: 7500
  };

  /* Montar mapa mensal real do banco */
  const active = rows.filter(p => p.status !== 'cancelado');
  const monthMap = {};
  active.forEach(p => {
    const d = p.payment_date || p.project_date || '';
    if (!d) return;
    const m = parseInt(d.substring(5,7));
    if (!m || m < 1 || m > 12) return;
    monthMap[m] = (monthMap[m] || 0) + (parseFloat(p.total_value) || 0);
  });

  /* Se banco está vazio, usar planilha */
  const hasData = Object.keys(monthMap).length > 0;
  const sourceMap = hasData ? monthMap : PLAN_2026;

  /* Meses com dado */
  const months   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const vals     = months.map(m => sourceMap[m] || 0);
  const maxVal   = Math.max(...vals, 1);
  const maxMonth = vals.indexOf(Math.max(...vals));

  barEl.innerHTML = months.map((m, i) => {
    const v   = vals[i];
    const pct = Math.round((v / maxVal) * 100);
    const col = i === maxMonth ? 'var(--c-p)' : v > 0 ? 'rgba(var(--pr),.5)' : 'rgba(255,255,255,.05)';
    return `<div title="${MONTH_ABBR[m-1]}: ${fmtBRL(v)}" style="flex:1;background:${col};border-radius:2px 2px 0 0;height:${Math.max(pct,2)}%;min-height:${v > 0 ? '3px' : '2px'};cursor:default;transition:height .3s"></div>`;
  }).join('');

  lblEl.innerHTML = months.map((m, i) => {
    const v = vals[i];
    return `<div style="flex:1;text-align:center;font-size:8px;font-family:'Share Tech Mono',monospace;color:${v > 0 ? '#88aacc' : 'rgba(255,255,255,.15)'};">${MONTH_ABBR[m-1]}</div>`;
  }).join('');
}

/* ── Sincronizar projetos com dashboard (botão manual) ── */
async function syncProjectsWithDashboard() {
  const ss = document.getElementById('projSyncStatus');
  if (ss) ss.innerHTML = `<i class="fas fa-spinner fa-spin" style="font-size:8px;margin-right:4px;color:#ffcc00"></i><span style="color:#ffcc00">SINCRONIZANDO...</span>`;
  await loadProjects();
  /* Forçar reload do dashboard também */
  if (typeof loadDashboard === 'function') loadDashboard();
  showToast('Projetos sincronizados com Dashboard!', 'fa-sync-alt');
}

/* ── Renderizar linha (modo leitura) ── */
function renderProjectRow(p) {
  const val    = parseFloat(p.total_value) || 0;
  const cost   = parseFloat(p.cost)        || 0;
  /* Se vier do SYNC com custo real do fechamento, usar _profit; senão calcular */
  const profitPct = p._hasFech && p._profitPct !== undefined
    ? parseFloat(p._profitPct).toFixed(1)
    : (val > 0 ? ((val - cost) / val * 100).toFixed(1) : null);
  const nps    = parseFloat(p.nps) || 0;
  const isNew  = p.is_new_client === true || p.is_new_client === 'true';
  const seg    = p.segment || PROJ_2026_SEGMENTS[p.client_name] || '';

  /* Badge colorido de status */
  const statusLabels = { pendente:'PENDENTE', em_andamento:'EM AND.', concluido:'CONCLUÍDO', cancelado:'CANCELADO' };
  const statusLabel  = statusLabels[p.status] || (p.status||'PENDENTE').toUpperCase();

  /* Cor da linha por status */
  const rowStyle = p.status === 'cancelado' ? 'opacity:.45' :
                   p.status === 'concluido'  ? 'border-left:2px solid rgba(0,255,136,.3)' : '';

  /* Indicador de custo real do fechamento */
  const costBadge = p._hasFech
    ? '<i class="fas fa-check-circle" title="Custo real do fechamento" style="font-size:7px;color:#00ff88;margin-left:3px"></i>'
    : '';

  return `
    <tr data-pid="${p.id}" class="proj-row" style="${rowStyle}" title="Clique em qualquer campo para editar inline">
      <td class="editable-cell editable-date" data-field="payment_date" data-pid="${p.id}" onclick="startInlineEdit(this)" style="white-space:nowrap">
        <span style="font-family:'Orbitron',sans-serif;font-size:10px;color:#88aacc">${fmtDateShort(p.payment_date || p.project_date)}</span>
        <i class="fas fa-pen inline-edit-icon"></i>
      </td>
      <td class="editable-cell" data-field="client_name" data-pid="${p.id}" onclick="startInlineEdit(this)">
        <b style="color:#e4eeff">${escCell(p.client_name)||'—'}</b>
        <i class="fas fa-pen inline-edit-icon"></i>
      </td>
      <td class="editable-cell" data-field="project_name" data-pid="${p.id}" onclick="startInlineEdit(this)">
        ${escCell(p.project_name)||'—'}<i class="fas fa-pen inline-edit-icon"></i>
      </td>
      <td style="color:#88aacc;font-size:10px">${escCell(seg)||'—'}</td>
      <td class="editable-cell editable-currency" data-field="total_value" data-pid="${p.id}" onclick="startInlineEdit(this)">
        <span style="color:var(--c-g);font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700">${fmtBRL(val)}</span>
        <i class="fas fa-pen inline-edit-icon"></i>
      </td>
      <td class="editable-cell editable-currency" data-field="cost" data-pid="${p.id}" onclick="startInlineEdit(this)">
        <span style="color:#ff9944;font-family:'Orbitron',sans-serif;font-size:11px">${cost > 0 ? fmtBRL(cost) : '<span style="opacity:.35">—</span>'}</span>
        ${costBadge}
        <i class="fas fa-pen inline-edit-icon"></i>
      </td>
      <td>
        <span style="color:${getProfitColor(profitPct)};font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700">${profitPct !== null ? profitPct + '%' : '—'}</span>
      </td>
      <td class="editable-cell editable-nps" data-field="nps" data-pid="${p.id}" onclick="startInlineEdit(this)">
        <span class="nps-cell ${npsClass(nps)}">${nps > 0 ? nps + '★' : '—'}</span>
        <i class="fas fa-pen inline-edit-icon"></i>
      </td>
      <td class="editable-cell editable-select" data-field="status" data-pid="${p.id}" onclick="startInlineEdit(this)">
        <span class="badge badge-${p.status||'pendente'}">${statusLabel}</span>
        <i class="fas fa-pen inline-edit-icon"></i>
      </td>
      <td class="editable-cell editable-select" data-field="is_new_client" data-pid="${p.id}" onclick="startInlineEdit(this)">
        ${isNew ? '<span class="badge" style="background:rgba(0,255,136,.1);border-color:rgba(0,255,136,.3);color:#00ff88;font-size:8px">✦ NOVO</span>' : '<span style="font-size:10px;color:#88aacc">—</span>'}
        <i class="fas fa-pen inline-edit-icon"></i>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn-icon" title="Editar (modal)" onclick="editProject('${p.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger" title="Excluir" onclick="deleteProject('${p.id}','${escCell(p.client_name||'').replace(/'/g,'')}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
}

/* ── Edição inline: iniciar ── */
function startInlineEdit(cell) {
  /* Evitar iniciar edição se já editando */
  if (cell.classList.contains('editing')) return;
  /* Fechar qualquer edição aberta */
  document.querySelectorAll('.proj-row td.editing').forEach(c => cancelInlineEdit(c));

  const field = cell.dataset.field;
  const pid   = cell.dataset.pid;
  const proj  = _projectsCache.find(p => p.id === pid);
  if (!proj) return;

  cell.classList.add('editing');
  const rawVal = proj[field] ?? '';

  let input;

  if (field === 'status') {
    input = document.createElement('select');
    input.className = 'inline-edit-input hud-select';
    [['pendente','PENDENTE'],['em_andamento','EM ANDAMENTO'],['concluido','CONCLUÍDO'],['cancelado','CANCELADO']].forEach(([v,l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      if (v === rawVal) o.selected = true;
      input.appendChild(o);
    });
  } else if (field === 'category') {
    input = document.createElement('select');
    input.className = 'inline-edit-input hud-select';
    [['evento','EVENTO'],['publicidade','PUBLICIDADE'],['campanha','CAMPANHA'],['clipe','CLIPE'],['producao_recorrente','PRODUÇÃO RECORRENTE']].forEach(([v,l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      if (v === rawVal) o.selected = true;
      input.appendChild(o);
    });
  } else if (field === 'is_new_client') {
    input = document.createElement('select');
    input.className = 'inline-edit-input hud-select';
    [['false','Não'],['true','Sim']].forEach(([v,l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      const cur = (rawVal === true || rawVal === 'true') ? 'true' : 'false';
      if (v === cur) o.selected = true;
      input.appendChild(o);
    });
  } else if (field === 'payment_date' || field === 'project_date') {
    input = document.createElement('input');
    input.type  = 'date';
    input.className = 'inline-edit-input hud-input';
    input.value = rawVal;
  } else if (field === 'total_value' || field === 'cost' || field === 'nps') {
    input = document.createElement('input');
    input.type  = 'number';
    input.className = 'inline-edit-input hud-input';
    input.value = rawVal;
    input.step  = field === 'nps' ? '1' : '0.01';
    if (field === 'nps') { input.min = '0'; input.max = '10'; }
  } else {
    input = document.createElement('input');
    input.type  = 'text';
    input.className = 'inline-edit-input hud-input';
    input.value = rawVal;
  }

  /* Botões de ação */
  const wrap = document.createElement('div');
  wrap.className = 'inline-edit-wrap';
  wrap.appendChild(input);

  const btnOk = document.createElement('button');
  btnOk.className = 'inline-btn-ok';
  btnOk.innerHTML = '<i class="fas fa-check"></i>';
  btnOk.title = 'Salvar (Enter)';

  const btnX = document.createElement('button');
  btnX.className = 'inline-btn-cancel';
  btnX.innerHTML = '<i class="fas fa-times"></i>';
  btnX.title = 'Cancelar (Esc)';

  wrap.appendChild(btnOk);
  wrap.appendChild(btnX);

  cell.innerHTML = '';
  cell.appendChild(wrap);
  input.focus();
  if (input.select) input.select();

  btnOk.addEventListener('click', e => { e.stopPropagation(); confirmInlineEdit(cell, pid, field, input.value); });
  btnX.addEventListener('click',  e => { e.stopPropagation(); loadProjects(); });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); confirmInlineEdit(cell, pid, field, input.value); }
    if (e.key === 'Escape') { e.preventDefault(); loadProjects(); }
    e.stopPropagation();
  });
  input.addEventListener('click', e => e.stopPropagation());
}

function cancelInlineEdit(cell) { loadProjects(); }

/* ── Edição inline: confirmar e salvar ── */
async function confirmInlineEdit(cell, pid, field, newVal) {
  /* Montar payload */
  const payload = {};

  if (field === 'total_value' || field === 'cost') {
    payload[field] = parseFloat(newVal) || 0;
    /* Recalcular lucro */
    const proj = _projectsCache.find(p => p.id === pid);
    if (proj) {
      const tv   = field === 'total_value' ? (parseFloat(newVal)||0) : (parseFloat(proj.total_value)||0);
      const cost = field === 'cost'        ? (parseFloat(newVal)||0) : (parseFloat(proj.cost)||0);
      payload.profit_pct = tv > 0 ? ((tv - cost) / tv * 100).toFixed(1) : 0;
    }
  } else if (field === 'nps') {
    payload[field] = parseFloat(newVal) || 0;
  } else if (field === 'is_new_client') {
    payload[field] = newVal === 'true';
  } else {
    payload[field] = newVal;
  }

  /* Visual de loading */
  cell.style.opacity = '0.5';

  try {
    const res = await fetch(`tables/age_projects/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const saved = await res.json();
      showToast('Salvo!', 'fa-check-circle');
      await loadProjects();
      /* ── Dashboard sempre sincronizado (integração total 2026) ── */
      loadDashboard();
      /* ── SYNC: propagar edição inline para Kanban, Histórico etc. ── */
      if (window.SYNC) await window.SYNC.onProjectSaved(saved);
    } else {
      showToast('Erro ao salvar', 'fa-exclamation-triangle');
      loadProjects();
    }
  } catch(e) {
    showToast('Erro ao salvar', 'fa-exclamation-triangle');
    loadProjects();
  }
}

/* ── Escape HTML para células ── */
function escCell(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function calcProfit() {
  const val = parseFloat(document.getElementById('pValue')?.value) || 0;
  const cost = parseFloat(document.getElementById('pCost')?.value) || 0;
  const pPct = document.getElementById('pProfit');
  if (pPct && val > 0) pPct.value = ((val - cost) / val * 100).toFixed(1);
  else if (pPct) pPct.value = '';
}

function openProjectModal(project = null) {
  document.getElementById('modalProjectTitle').textContent = project ? 'EDITAR PROJETO' : 'NOVO PROJETO';
  document.getElementById('editProjectId').value = project?.id || '';
  document.getElementById('pClient').value = project?.client_name || '';
  document.getElementById('pName').value = project?.project_name || '';
  document.getElementById('pCategory').value = project?.category || 'evento';
  document.getElementById('pStatus').value = project?.status || 'pendente';
  document.getElementById('pStartDate').value = project?.project_date || '';
  document.getElementById('pPayDate').value = project?.payment_date || '';
  document.getElementById('pValue').value = project?.total_value || '';
  document.getElementById('pCost').value = project?.cost || '';
  document.getElementById('pProfit').value = project?.profit_pct || '';
  document.getElementById('pNps').value = project?.nps || '';
  document.getElementById('pNewClient').value = (project?.is_new_client === true || project?.is_new_client === 'true') ? 'true' : 'false';
  openModal('modalProject');
}

async function editProject(id) {
  try {
    const res = await fetch(`tables/age_projects/${id}`);
    if (res.ok) {
      const p = await res.json();
      openProjectModal(p);
    }
  } catch(e) { showToast('Erro ao carregar projeto', 'fa-exclamation-triangle'); }
}

async function saveProject() {
  const id = document.getElementById('editProjectId').value;
  const val = parseFloat(document.getElementById('pValue').value) || 0;
  const cost = parseFloat(document.getElementById('pCost').value) || 0;
  const profitPct = val > 0 ? ((val - cost) / val * 100) : 0;

  const payload = {
    client_name: document.getElementById('pClient').value.trim(),
    project_name: document.getElementById('pName').value.trim(),
    category: document.getElementById('pCategory').value,
    status: document.getElementById('pStatus').value,
    project_date: document.getElementById('pStartDate').value,
    payment_date: document.getElementById('pPayDate').value,
    total_value: val,
    cost: cost,
    profit_pct: profitPct.toFixed(1),
    nps: parseFloat(document.getElementById('pNps').value) || 0,
    is_new_client: document.getElementById('pNewClient').value,
    created_by: currentUser?.username || 'unknown'
  };

  if (!payload.client_name || !payload.project_name) {
    showToast('Preencha cliente e nome do projeto', 'fa-exclamation-triangle'); return;
  }

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `tables/age_projects/${id}` : 'tables/age_projects';
    const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (res.ok) {
      const saved = await res.json();
      closeModal('modalProject');
      showToast(id ? 'Projeto atualizado!' : 'Projeto criado!', 'fa-check-circle');
      /* ── Recarregar projetos + dashboard sempre (integração total) ── */
      await loadProjects();
      loadDashboard();   /* dashboard recarrega independente de estar ativo */
      /* ── SYNC: propagar para Kanban, Fechamento, Histórico ── */
      if (window.SYNC) await window.SYNC.onProjectSaved(saved);
    }
  } catch(e) { showToast('Erro ao salvar projeto', 'fa-exclamation-triangle'); }
}

function deleteProject(id, name) {
  showConfirm(`Excluir projeto de <b>${name}</b>?`, async () => {
    try {
      await fetch(`tables/age_projects/${id}`, { method: 'DELETE' });
      showToast('Projeto excluído', 'fa-trash');
      /* ── Recarregar projetos + dashboard sempre (integração total) ── */
      await loadProjects();
      loadDashboard();   /* dashboard recarrega independente de estar ativo */
      /* ── SYNC: recarregar kanban, fechamento e histórico ── */
      if (window.SYNC) window.SYNC.reloadAll();
    } catch(e) { showToast('Erro ao excluir', 'fa-exclamation-triangle'); }
  });
}

/* ══════════════════════════════════════════════════════════
   MY DAY  (private per user)
   ══════════════════════════════════════════════════════════ */
let currentDayId = null;

async function loadMyDay() {
  const res = await fetch(`tables/age_tasks?limit=200`);
  const data = res.ok ? await res.json() : { data: [] };
  const allTasks = (data.data || []).filter(t => !t.deleted && t.owner === currentUser.username);
  _cachedAllTasks = allTasks; // cache para gamificação instantânea

  // Get unique days
  const days = {};
  allTasks.forEach(t => {
    const d = t.day_label || 'Geral';
    if (!days[d]) days[d] = { label: d, focus: t.day_focus || '' };
  });

  const tabsEl = document.getElementById('myDayTabs');
  if (!tabsEl) return;

  const dayList = Object.values(days);

  // Populate day filter
  const dayFilter = document.getElementById('taskFilterDay');
  if (dayFilter) {
    dayFilter.innerHTML = '<option value="">Todos os dias</option>' +
      dayList.map(d => `<option value="${d.label}">${d.label}</option>`).join('');
  }

  if (!dayList.length) {
    tabsEl.innerHTML = '';
    document.getElementById('myDayContent').innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--bdm);font-family:'Share Tech Mono',monospace;font-size:11px">
        NENHUM DIA CADASTRADO — CLIQUE EM "+ NOVO DIA" PARA COMEÇAR
      </div>`;
    return;
  }

  if (!currentDayId || !days[currentDayId]) {
    currentDayId = dayList[0].label;
  }

  tabsEl.innerHTML = dayList.map(d => {
    const dayTasks = allTasks.filter(t => t.day_label === d.label && !t.is_day_placeholder);
    const done = dayTasks.filter(t => t.done === true || t.done === 'true').length;
    const total = dayTasks.length;
    const pct = total ? Math.round(done/total*100) : 0;
    const r = 17; const circ = +(2 * Math.PI * r).toFixed(2);
    const offset = +(circ - (pct / 100) * circ).toFixed(2);
    const isComplete = pct === 100 && total > 0;
    return `
      <div class="day-tab-btn ${d.label === currentDayId ? 'active' : ''}" onclick="switchDayView('${d.label.replace(/'/g,'\\\'')}')" >
        <div class="day-tab-ring">
          <svg width="38" height="38" viewBox="0 0 38 38">
            <circle class="day-tab-ring-bg" cx="19" cy="19" r="${r}"/>
            <circle class="day-tab-ring-fill" cx="19" cy="19" r="${r}"
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
              ${isComplete ? 'stroke="#00ff88"' : ''}/>
          </svg>
          <div class="day-tab-ring-text">${pct}%</div>
        </div>
        <span class="day-tab-label">${d.label.toUpperCase().slice(0,8)}</span>
        ${isComplete ? '<span class="streak-badge">✓ FEITO</span>' : ''}
        <button class="day-tab-del" title="Excluir dia" onclick="event.stopPropagation();deleteDayTasks('${d.label.replace(/'/g,'\\\'')}')"><i class="fas fa-times"></i></button>
      </div>
    `;
  }).join('');

  renderDayContent(currentDayId, allTasks);
}

async function switchDayView(dayLabel) {
  currentDayId = dayLabel;
  await loadMyDay();
}

function renderDayContent(dayLabel, allTasks) {
  const contentEl = document.getElementById('myDayContent');
  if (!contentEl) return;
  const dayTasks = allTasks.filter(t => t.day_label === dayLabel);
  const done = dayTasks.filter(t => t.done === true || t.done === 'true').length;
  const total = dayTasks.length;
  const pct = total ? Math.round(done/total*100) : 0;
  const focus = dayTasks[0]?.day_focus || '';

  // Group by area
  const areas = {};
  dayTasks.forEach(t => {
    const a = t.area || 'GERAL';
    if (!areas[a]) areas[a] = [];
    areas[a].push(t);
  });

  contentEl.innerHTML = `
    <div class="day-panel-header">
      <div class="day-focus-label">FOCO DO DIA</div>
      <div class="day-focus-text">${focus || 'Sem foco definido'}</div>
      <div class="day-prog-row">
        <div class="day-prog-num">${pct}%</div>
        <div class="day-prog-right">
          <div class="xp-track">
            <div class="xp-fill" style="width:${pct}%"></div>
            <div class="xp-glow" style="width:${pct}%"></div>
          </div>
          <div class="day-prog-count">${done} / ${total} concluídas</div>
        </div>
      </div>
    </div>
    ${Object.entries(areas).map(([area, tasks]) => `
      <div style="margin-bottom:16px">
        <div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--bdm);letter-spacing:2px;margin-bottom:8px;padding:4px 0;border-bottom:1px solid var(--bd)">${area}</div>
        ${tasks.map(t => renderTaskItem(t)).join('')}
      </div>
    `).join('')}
    <div class="add-task-inline" onclick="openAddTaskModalForDay('${dayLabel.replace(/'/g,'\\\'')}','${focus.replace(/'/g,'\\\'')}')">
      <i class="fas fa-plus"></i>
      <span>Adicionar tarefa em ${dayLabel}</span>
    </div>
  `;
}

function renderTaskItem(t) {
  const isDone = t.done === true || t.done === 'true';
  const prioColors = { high:'var(--c-p)', med:'var(--c-s)', low:'var(--bdm)' };
  const prioLabels = { high:'ALTA ⚡', med:'MÉDIA', low:'BAIXA' };
  const pc = prioColors[t.priority] || prioColors.med;
  const pl = prioLabels[t.priority] || 'MÉDIA';
  return `
    <div class="task-item ${isDone ? 'done' : ''}" id="task-${t.id}" style="position:relative">
      <div class="task-check" onclick="toggleTask('${t.id}', ${!isDone})" title="${isDone ? 'Desmarcar tarefa' : 'Concluir — +10 XP'}">
        <i class="fas fa-check"></i>
      </div>
      <div class="task-body">
        <div class="task-label">${t.label || '—'}</div>
        <div class="task-meta">
          ${t.priority ? `<span class="task-badge" style="color:${pc};border-color:${pc}44">${pl}</span>` : ''}
          ${t.area ? `<span class="task-badge">${t.area}</span>` : ''}
          ${isDone
            ? `<span class="task-badge" style="color:#00ff88;border-color:rgba(0,255,136,.35)">✓ CONCLUÍDA</span>`
            : `<span class="task-badge" style="color:#ffcc00;border-color:rgba(255,204,0,.2)">⚡ +10 XP</span>`
          }
          ${t.is_private === 'false' || t.is_private === false
            ? '<span class="task-badge" style="color:#00aaff;border-color:rgba(0,170,255,.3)"><i class="fas fa-users" style="font-size:7px"></i> EQUIPE</span>'
            : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon" title="Editar" onclick="editTask('${t.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-icon danger" title="Excluir" onclick="deleteTask('${t.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `;
}

/* Cache das tarefas — para gamificação instantânea */
let _cachedAllTasks = [];

async function toggleTask(id, isDone) {
  const taskEl   = document.getElementById(`task-${id}`);
  const cached   = _cachedAllTasks.find(t => t.id === id);
  const dayLabel = cached?.day_label || currentDayId || '';

  if (window.GAME) {
    await window.GAME.toggleTask(id, isDone, taskEl, dayLabel, _cachedAllTasks);
    if (cached) cached.done = isDone;
  } else {
    try {
      await fetch(`tables/age_tasks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: isDone })
      });
    } catch(e) {}
    loadMyDay(); loadMyTasks();
  }
}

/* ── Add Task Modal helpers ── */
let _addTaskDay = '', _addTaskFocus = '';

function openAddTaskModalForDay(day, focus) {
  _addTaskDay = day;
  _addTaskFocus = focus;
  document.getElementById('modalTaskTitle').textContent = 'NOVA TAREFA';
  document.getElementById('editTaskId').value = '';
  document.getElementById('tLabel').value = '';
  document.getElementById('tArea').value = '';
  document.getElementById('tDay').value = day;
  document.getElementById('tPriority').value = 'med';
  document.getElementById('tPrivate').value = 'true';
  openModal('modalTask');
}

function openAddTaskModal() {
  _addTaskDay = '';
  _addTaskFocus = '';
  document.getElementById('modalTaskTitle').textContent = 'NOVA TAREFA';
  document.getElementById('editTaskId').value = '';
  document.getElementById('tLabel').value = '';
  document.getElementById('tArea').value = '';
  document.getElementById('tDay').value = currentDayId || '';
  document.getElementById('tPriority').value = 'med';
  document.getElementById('tPrivate').value = 'true';
  openModal('modalTask');
}

async function editTask(id) {
  try {
    const res = await fetch(`tables/age_tasks/${id}`);
    if (res.ok) {
      const t = await res.json();
      document.getElementById('modalTaskTitle').textContent = 'EDITAR TAREFA';
      document.getElementById('editTaskId').value = t.id;
      document.getElementById('tLabel').value = t.label || '';
      document.getElementById('tArea').value = t.area || '';
      document.getElementById('tDay').value = t.day_label || '';
      document.getElementById('tPriority').value = t.priority || 'med';
      document.getElementById('tPrivate').value = (t.is_private === false || t.is_private === 'false') ? 'false' : 'true';
      openModal('modalTask');
    }
  } catch(e) {}
}

async function saveTask() {
  const id = document.getElementById('editTaskId').value;
  const label = document.getElementById('tLabel').value.trim();
  const area = document.getElementById('tArea').value.trim().toUpperCase() || 'GERAL';
  const day = document.getElementById('tDay').value.trim();
  const priority = document.getElementById('tPriority').value;
  const isPrivate = document.getElementById('tPrivate').value;

  if (!label) { showToast('Informe a descrição da tarefa', 'fa-exclamation-triangle'); return; }

  const payload = {
    label, area,
    day_label: day || 'Geral',
    day_focus: _addTaskFocus,
    priority,
    is_private: isPrivate,
    done: false,
    owner: currentUser.username
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `tables/age_tasks/${id}` : 'tables/age_tasks';
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (res.ok) {
      closeModal('modalTask');
      showToast(id ? 'Tarefa atualizada!' : 'Tarefa adicionada!', 'fa-check-circle');
      loadMyDay();
      loadMyTasks();
    }
  } catch(e) { showToast('Erro ao salvar tarefa', 'fa-exclamation-triangle'); }
}

function deleteTask(id) {
  showConfirm('Excluir esta tarefa?', async () => {
    try {
      await fetch(`tables/age_tasks/${id}`, { method: 'DELETE' });
      showToast('Tarefa excluída', 'fa-trash');
      loadMyDay();
      loadMyTasks();
    } catch(e) {}
  });
}

function deleteDayTasks(dayLabel) {
  showConfirm(`Excluir todas as tarefas do dia <b>${dayLabel}</b>?`, async () => {
    try {
      const res = await fetch(`tables/age_tasks?limit=200`);
      const data = res.ok ? await res.json() : { data: [] };
      const toDelete = (data.data || []).filter(t => t.owner === currentUser.username && t.day_label === dayLabel && !t.deleted);
      await Promise.all(toDelete.map(t => fetch(`tables/age_tasks/${t.id}`, { method:'DELETE' })));
      if (currentDayId === dayLabel) currentDayId = null;
      showToast(`Dia ${dayLabel} excluído`, 'fa-trash');
      loadMyDay();
    } catch(e) {}
  });
}

/* ── New Day Modal ── */
function openAddDayModal() {
  document.getElementById('dLabel').value = '';
  document.getElementById('dFocus').value = '';
  openModal('modalDay');
}

async function saveDay() {
  const label = document.getElementById('dLabel').value.trim();
  const focus = document.getElementById('dFocus').value.trim();
  if (!label) { showToast('Informe o nome do dia', 'fa-exclamation-triangle'); return; }

  // Create a placeholder task just to register the day
  const payload = {
    label: `[DIA] ${label} criado`,
    area: 'GERAL',
    day_label: label,
    day_focus: focus,
    priority: 'low',
    is_private: 'true',
    done: false,
    owner: currentUser.username,
    is_day_placeholder: true
  };

  try {
    const res = await fetch('tables/age_tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (res.ok) {
      currentDayId = label;
      closeModal('modalDay');
      showToast(`Dia ${label} criado!`, 'fa-calendar-plus');
      loadMyDay();
    }
  } catch(e) { showToast('Erro ao criar dia', 'fa-exclamation-triangle'); }
}

/* ══════════════════════════════════════════════════════════
   MY TASKS  (list view with progress)
   ══════════════════════════════════════════════════════════ */
async function loadMyTasks() {
  const dayFilter = document.getElementById('taskFilterDay')?.value || '';
  try {
    const res = await fetch('tables/age_tasks?limit=200');
    const data = res.ok ? await res.json() : { data: [] };
    let tasks = (data.data || []).filter(t => !t.deleted && t.owner === currentUser.username && !t.is_day_placeholder);
    if (dayFilter) tasks = tasks.filter(t => t.day_label === dayFilter);

    // Progress
    const done = tasks.filter(t => t.done === true || t.done === 'true').length;
    const total = tasks.length;
    const pct = total ? Math.round(done/total*100) : 0;
    const pctEl = document.getElementById('taskProgressPct');
    const fillEl = document.getElementById('taskProgressFill');
    const glowEl = document.getElementById('taskProgressGlow');
    const cntEl = document.getElementById('taskProgressCount');
    if (pctEl) pctEl.textContent = pct + '%';
    if (fillEl) fillEl.style.width = pct + '%';
    if (glowEl) glowEl.style.width = pct + '%';
    if (cntEl) cntEl.textContent = `${done} / ${total} concluídas`;

    // Group by day
    const byDay = {};
    tasks.forEach(t => {
      const d = t.day_label || 'Geral';
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(t);
    });

    const listEl = document.getElementById('myTasksList');
    if (!listEl) return;
    if (!tasks.length) {
      listEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--bdm);font-family:'Share Tech Mono',monospace;font-size:11px">NENHUMA TAREFA — CLIQUE EM "+ NOVA TAREFA"</div>`;
      return;
    }

    listEl.innerHTML = Object.entries(byDay).map(([day, dayTasks]) => {
      const d = dayTasks.filter(t=>t.done===true||t.done==='true').length;
      const p = Math.round(d/dayTasks.length*100);
      return `
        <div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;color:var(--c-p);letter-spacing:2px">${day.toUpperCase()}</div>
            <div style="font-family:'Orbitron',sans-serif;font-size:11px;font-weight:900;color:var(--c-g);text-shadow:var(--gs)">${p}%</div>
          </div>
          ${dayTasks.map(t => renderTaskItem(t)).join('')}
        </div>
      `;
    }).join('');

  } catch(e) {
    console.error('loadMyTasks error:', e);
  }
}

/* ══════════════════════════════════════════════════════════
   MY FINANCE  (personal, private)
   ══════════════════════════════════════════════════════════ */
async function loadMyFinance() {
  try {
    const res = await fetch('tables/age_finance?limit=200');
    const data = res.ok ? await res.json() : { data: [] };
    const items = (data.data || []).filter(f => !f.deleted && f.owner === currentUser.username);

    const totalVal = items.reduce((s,f) => s+(parseFloat(f.value)||0), 0);
    const received = items.filter(f => f.received === true || f.received === 'true');
    const receivedVal = received.reduce((s,f) => s+(parseFloat(f.value)||0), 0);
    const pending = items.filter(f => f.received !== true && f.received !== 'true');
    const pendingVal = pending.reduce((s,f) => s+(parseFloat(f.value)||0), 0);

    const sumEl = document.getElementById('financeSummary');
    if (sumEl) sumEl.innerHTML = `
      <div class="fin-sum-card">
        <div class="fin-sum-label">TOTAL PREVISTO</div>
        <div class="fin-sum-value">${fmtBRL(totalVal)}</div>
      </div>
      <div class="fin-sum-card" style="--c-p:#00ff88;--pr:0,255,136">
        <div class="fin-sum-label">RECEBIDO</div>
        <div class="fin-sum-value" style="color:#00ff88">${fmtBRL(receivedVal)}</div>
      </div>
      <div class="fin-sum-card" style="--c-p:#ffcc00;--pr:255,204,0">
        <div class="fin-sum-label">PENDENTE</div>
        <div class="fin-sum-value" style="color:#ffcc00">${fmtBRL(pendingVal)}</div>
      </div>
    `;

    const listEl = document.getElementById('myFinanceList');
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--bdm);font-family:'Share Tech Mono',monospace;font-size:11px">NENHUM LANÇAMENTO — CLIQUE EM "+ NOVO LANÇAMENTO"</div>`;
      return;
    }

    const sorted = [...items].sort((a,b) => new Date(a.due_date||0) - new Date(b.due_date||0));
    listEl.innerHTML = sorted.map(f => {
      const isRec = f.received === true || f.received === 'true';
      return `
        <div class="fin-card ${isRec ? 'received' : ''}" id="fin-${f.id}">
          <div class="fin-card-check" onclick="toggleFinance('${f.id}', ${!isRec})">
            <i class="fas fa-check"></i>
          </div>
          <div class="fin-card-body">
            <div class="fin-card-client">${f.client_name || '—'}</div>
            <div class="fin-card-value">${fmtBRL(f.value)}</div>
            <div class="fin-card-desc">${f.description || ''} ${f.due_date ? '· VENCE: '+fmtDate(f.due_date) : ''}</div>
          </div>
          <div class="fin-card-actions">
            <span class="badge ${isRec ? 'badge-concluido' : 'badge-pendente'}" style="margin-right:6px">${isRec ? 'RECEBIDO' : 'PENDENTE'}</span>
            <button class="btn-icon" title="Editar" onclick="editFinance('${f.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-icon danger" title="Excluir" onclick="deleteFinance('${f.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');

  } catch(e) { console.error('Finance error:', e); }
}

async function toggleFinance(id, received) {
  if (received && window.GAME) {
    const el = document.getElementById(`fin-${id}`);
    window.GAME.financeReceived(el);
  }
  try {
    await fetch(`tables/age_finance/${id}`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ received })
    });
    loadMyFinance();
  } catch(e) {}
}

function openAddFinanceModal() {
  document.getElementById('modalFinTitle').textContent = 'NOVO LANÇAMENTO';
  document.getElementById('editFinId').value = '';
  document.getElementById('fClient').value = '';
  document.getElementById('fValue').value = '';
  document.getElementById('fDate').value = '';
  document.getElementById('fDesc').value = '';
  document.getElementById('fReceived').value = 'false';
  openModal('modalFinance');
}

async function editFinance(id) {
  try {
    const res = await fetch(`tables/age_finance/${id}`);
    if (res.ok) {
      const f = await res.json();
      document.getElementById('modalFinTitle').textContent = 'EDITAR LANÇAMENTO';
      document.getElementById('editFinId').value = f.id;
      document.getElementById('fClient').value = f.client_name || '';
      document.getElementById('fValue').value = f.value || '';
      document.getElementById('fDate').value = f.due_date || '';
      document.getElementById('fDesc').value = f.description || '';
      document.getElementById('fReceived').value = (f.received === true || f.received === 'true') ? 'true' : 'false';
      openModal('modalFinance');
    }
  } catch(e) {}
}

async function saveFinance() {
  const id = document.getElementById('editFinId').value;
  const client = document.getElementById('fClient').value.trim();
  const value = parseFloat(document.getElementById('fValue').value) || 0;
  const dueDate = document.getElementById('fDate').value;
  const desc = document.getElementById('fDesc').value.trim();
  const received = document.getElementById('fReceived').value;

  if (!client || !value) { showToast('Preencha cliente e valor', 'fa-exclamation-triangle'); return; }

  const payload = { client_name: client, value, due_date: dueDate, description: desc, received, owner: currentUser.username };
  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `tables/age_finance/${id}` : 'tables/age_finance';
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (res.ok) {
      closeModal('modalFinance');
      showToast(id ? 'Atualizado!' : 'Lançamento criado!', 'fa-check-circle');
      loadMyFinance();
    }
  } catch(e) { showToast('Erro ao salvar', 'fa-exclamation-triangle'); }
}

function deleteFinance(id) {
  showConfirm('Excluir este lançamento?', async () => {
    try {
      await fetch(`tables/age_finance/${id}`, { method:'DELETE' });
      showToast('Excluído', 'fa-trash');
      loadMyFinance();
    } catch(e) {}
  });
}

/* ══════════════════════════════════════════════════════════
   TEAM PAGE
   ══════════════════════════════════════════════════════════ */
async function loadTeam() {
  const el = document.getElementById('teamGrid');
  if (!el) return;
  const members = BUILTIN_USERS;
  el.innerHTML = members.map(m => {
    const isMe = currentUser && m.username === currentUser.username;
    return `
    <div class="team-card-full">
      <div class="team-full-avatar" style="background:${m.color}22;color:${m.color};border-color:${m.color}66">${m.avatar}</div>
      <div class="team-full-name">${m.name}</div>
      <div class="team-full-role">${m.role.toUpperCase()}</div>
      <div class="team-full-badge">${m.username}</div>
      ${isMe ? `<div class="team-full-badge" style="color:#00ff88;border-color:rgba(0,255,136,.3)">VOCÊ</div>` : ''}
    </div>`;
  }).join('') + `
    <div class="team-card-full" style="opacity:.5;border-style:dashed">
      <div class="team-full-avatar" style="font-size:28px;border-style:dashed"><i class="fas fa-camera"></i></div>
      <div class="team-full-name">FOTÓGRAFO</div>
      <div class="team-full-role">VAGA ABERTA</div>
      <div class="team-full-badge" style="color:#ffcc00;border-color:rgba(255,204,0,.4)">RECRUTANDO</div>
    </div>
    <div class="team-card-full" style="opacity:.5;border-style:dashed">
      <div class="team-full-avatar" style="font-size:28px;border-style:dashed"><i class="fas fa-pen-nib"></i></div>
      <div class="team-full-name">DESIGNER</div>
      <div class="team-full-role">VAGA ABERTA</div>
      <div class="team-full-badge" style="color:#ffcc00;border-color:rgba(255,204,0,.4)">RECRUTANDO</div>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════
   CSV IMPORT / EXPORT
   ══════════════════════════════════════════════════════════ */

/**
 * Expected CSV columns (header row):
 * cliente, projeto, categoria, data_projeto, data_pagamento, valor, custo, cliente_novo, nps, status
 */
async function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) { showToast('CSV vazio ou inválido', 'fa-exclamation-triangle'); return; }

  const header = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase()
    .replace(/[áàãâ]/g,'a').replace(/[éèê]/g,'e').replace(/[íì]/g,'i')
    .replace(/[óòõô]/g,'o').replace(/[úù]/g,'u').replace(/ç/g,'c').replace(/\s+/g,'_'));

  const categoryMap = {
    'evento': 'evento', 'event': 'evento',
    'publicidade': 'publicidade', 'advertising': 'publicidade', 'ads': 'publicidade',
    'campanha': 'campanha', 'campaign': 'campanha',
    'clipe': 'clipe', 'clip': 'clipe', 'clipe musical': 'clipe',
    'producao_recorrente': 'producao_recorrente', 'recorrente': 'producao_recorrente',
    'recurrent': 'producao_recorrente', 'retainer': 'producao_recorrente'
  };

  const getCol = (row, ...names) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0 && row[idx] !== undefined) return row[idx].trim();
    }
    return '';
  };

  let imported = 0, errors = 0;
  const promises = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;]/).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
    if (cols.length < 3) continue;

    const clientName = getCol(cols, 'cliente', 'client', 'client_name', 'nome_cliente');
    const projectName = getCol(cols, 'projeto', 'project', 'project_name', 'nome_projeto', 'titulo', 'title');
    if (!clientName && !projectName) continue;

    const rawCat = getCol(cols, 'categoria', 'category', 'tipo', 'type').toLowerCase();
    const category = categoryMap[rawCat] || 'evento';

    const rawVal = getCol(cols, 'valor', 'value', 'total_value', 'total', 'receita', 'revenue').replace(/[R$.\s]/g,'').replace(',','.');
    const rawCost = getCol(cols, 'custo', 'cost', 'custos').replace(/[R$.\s]/g,'').replace(',','.');
    const totalValue = parseFloat(rawVal) || 0;
    const cost = parseFloat(rawCost) || 0;
    const profitPct = totalValue > 0 ? ((totalValue - cost) / totalValue * 100).toFixed(1) : 0;

    const rawNps = getCol(cols, 'nps').replace(',','.');
    const nps = parseFloat(rawNps) || 0;

    const rawNew = getCol(cols, 'cliente_novo', 'new_client', 'novo').toLowerCase();
    const isNew = rawNew === 'sim' || rawNew === 'yes' || rawNew === 'true' || rawNew === '1';

    const rawStatus = getCol(cols, 'status', 'situacao').toLowerCase()
      .replace('pendente','pendente').replace('em andamento','em_andamento')
      .replace('concluido','concluido').replace('concluído','concluido')
      .replace('cancelado','cancelado');
    const validStatuses = ['pendente','em_andamento','concluido','cancelado'];
    const status = validStatuses.includes(rawStatus) ? rawStatus : 'pendente';

    const projDate = getCol(cols, 'data_projeto', 'project_date', 'data', 'date', 'data_inicio');
    const payDate = getCol(cols, 'data_pagamento', 'payment_date', 'pagamento');

    const payload = {
      client_name: clientName || 'Importado',
      project_name: projectName || 'Projeto importado',
      category, status, total_value: totalValue, cost,
      profit_pct: profitPct, nps, is_new_client: isNew,
      project_date: projDate, payment_date: payDate,
      created_by: currentUser?.username || 'import'
    };

    promises.push(
      fetch('tables/age_projects', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      }).then(r => { if (r.ok) imported++; else errors++; })
       .catch(() => errors++)
    );
  }

  await Promise.all(promises);
  event.target.value = '';
  showToast(`✅ ${imported} projetos importados${errors ? ` · ${errors} erros` : ''}`, 'fa-file-import');
  loadProjects();
  loadDashboard();
}

function exportProjectsCSV() {
  fetch('tables/age_projects?limit=500')
    .then(r => r.json())
    .then(data => {
      const projects = (data.data || []).filter(p => !p.deleted);
      /* Ordenar por data de pagamento DESC (mesmo que a tabela) */
      projects.sort((a, b) => {
        const da = a.payment_date || a.project_date || '';
        const db = b.payment_date || b.project_date || '';
        return da > db ? -1 : da < db ? 1 : 0;
      });
      const header = ['Data Pgto','Cliente','Projeto','Segmento','Categoria','Status','Valor','Custo','Lucro%','NPS','Cliente Novo'];
      const rows = projects.map(p => [
        p.payment_date||p.project_date||'',
        p.client_name||'', p.project_name||'',
        p.segment || PROJ_2026_SEGMENTS[p.client_name] || '',
        p.category||'', p.status||'',
        p.total_value||0, p.cost||0, p.profit_pct||0, p.nps||0,
        (p.is_new_client===true||p.is_new_client==='true') ? 'Sim' : 'Não'
      ]);
      const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `age_projetos_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('CSV exportado!', 'fa-download');
    })
    .catch(() => showToast('Erro ao exportar', 'fa-exclamation-triangle'));
}

/* ══════════════════════════════════════════════════════════
   CONFIRM DIALOG
   ══════════════════════════════════════════════════════════ */
function showConfirm(msg, callback) {
  document.getElementById('confirmText').innerHTML = msg;
  const btn = document.getElementById('confirmBtn');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    closeModal('modalConfirm');
    callback();
  });
  openModal('modalConfirm');
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
function initApp() {
  if (window.GAME && currentUser) {
    window.GAME.init(currentUser.username);
  }
  navigate('dashboard');
}

/* ══════════════════════════════════════════════════════════
   FECHAMENTO DE PROJETO
   ══════════════════════════════════════════════════════════ */

// Adicionar 'fechamento' ao mapa de páginas
PAGE_TITLES.fechamento  = 'FECHAMENTO';
PAGE_TITLES.chat        = 'MENSAGENS';
PAGE_TITLES.cronograma  = 'CRONOGRAMA';

let _currentFechId   = null; // fechamento selecionado
let _currentFechData = null; // dados do cabeçalho

/* ── Carregar página e popular select de projetos ── */
async function loadFechamento() {
  await loadFechamentoList();
  const sel = document.getElementById('fechProjectSelect');
  const pid = sel?.value;
  if (!pid) {
    showFechEmpty(true);
    return;
  }
  showFechEmpty(false);

  // Buscar ou criar fechamento para o projeto
  let fech = await getFechByProject(pid);
  if (!fech) {
    // Preencher com dados do projeto
    const proj = await fetchProject(pid);
    if (proj) {
      _currentFechData = {
        project_id: proj.id,
        project_name: proj.project_name || '',
        client_name: proj.client_name || '',
        total_value: parseFloat(proj.total_value) || 0,
        imposto_valor: 0,
        imposto_pct: 0,
        lucro_liquido: parseFloat(proj.total_value) || 0,
        observacoes: '',
        created_by: currentUser.username
      };
    } else {
      _currentFechData = { project_id: pid, total_value: 0, imposto_valor: 0, imposto_pct: 0, lucro_liquido: 0 };
    }
    _currentFechId = null;
  } else {
    _currentFechData = fech;
    _currentFechId   = fech.id;
  }

  await renderFechSummary();
  await renderGastos();
}

async function loadFechamentoList() {
  // Preencher select com projetos
  const sel = document.getElementById('fechProjectSelect');
  if (!sel) return;
  try {
    const res = await fetch('tables/age_projects?limit=200');
    const data = res.ok ? await res.json() : { data: [] };
    const projs = (data.data || []).filter(p => !p.deleted && p.status !== 'cancelado');
    const curVal = sel.value;
    sel.innerHTML = '<option value="">— Selecione um projeto —</option>' +
      projs.map(p => `<option value="${p.id}" ${p.id === curVal ? 'selected' : ''}>${p.client_name || '?'} · ${p.project_name || '?'}</option>`).join('');
    if (curVal) sel.value = curVal;
  } catch(e) {}
}

async function getFechByProject(pid) {
  try {
    const res = await fetch(`tables/age_fechamento?limit=10&search=${encodeURIComponent(pid)}`);
    const data = res.ok ? await res.json() : { data: [] };
    return (data.data || []).find(f => f.project_id === pid && !f.deleted) || null;
  } catch(e) { return null; }
}

async function fetchProject(pid) {
  try {
    const res = await fetch(`tables/age_projects/${pid}`);
    return res.ok ? await res.json() : null;
  } catch(e) { return null; }
}

/* ── Render resumo (cards + barra) ── */
async function renderFechSummary() {
  if (!_currentFechData) return;

  // Somar gastos do banco
  const totalGastos = await sumGastos(_currentFechId || _currentFechData.project_id);
  const totalValue   = parseFloat(_currentFechData.total_value) || 0;
  const imposto      = parseFloat(_currentFechData.imposto_valor) || 0;
  const lucro        = totalValue - imposto - totalGastos;
  const margemPct    = totalValue > 0 ? (lucro / totalValue * 100) : 0;
  const impostoPct   = totalValue > 0 ? (imposto / totalValue * 100) : 0;
  const custoTotal   = imposto + totalGastos;

  // Atualizar _currentFechData com lucro recalculado
  _currentFechData.lucro_liquido = lucro;

  // Cards
  setEl('fechValorProjeto', fmtBRL(totalValue));
  setEl('fechImposto', fmtBRL(imposto));
  setEl('fechImpostoPct', impostoPct.toFixed(1) + '% do total');
  setEl('fechTotalGastos', fmtBRL(totalGastos));
  setEl('fechLucroLiquido', fmtBRL(lucro));
  setEl('fechLucroPct', margemPct.toFixed(1) + '% de margem');

  // ── SYNC AUTOMÁTICO: atualizar age_projects com custo e margem reais ──
  const pid = _currentFechData.project_id;
  if (pid && window.SYNC) {
    // Silenciosamente atualizar o projeto com o custo real do fechamento
    await window.SYNC.onFechamentoSaved({ ..._currentFechData }, totalGastos);
  } else if (pid) {
    // Fallback sem SYNC
    const profitPct = totalValue > 0 ? (lucro / totalValue * 100).toFixed(2) : 0;
    fetch(`tables/age_projects/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost: custoTotal, profit_pct: profitPct })
    }).catch(() => {});
  }

  // Cor do lucro
  const lucroCard = document.getElementById('fechLucroCard');
  if (lucroCard) {
    lucroCard.style.borderColor = lucro >= 0 ? 'rgba(0,255,136,.35)' : 'rgba(255,68,68,.35)';
  }
  const lucroEl = document.getElementById('fechLucroLiquido');
  if (lucroEl) lucroEl.style.color = lucro >= 0 ? '#00ff88' : '#ff4444';

  // Barra de distribuição
  const distWrap = document.getElementById('fechDistWrap');
  if (distWrap && totalValue > 0) {
    distWrap.style.display = '';
    const lucroW  = Math.max(0, lucro / totalValue * 100).toFixed(1);
    const custoW  = Math.min(100, totalGastos / totalValue * 100).toFixed(1);
    const impostoW = Math.min(100, imposto / totalValue * 100).toFixed(1);
    const segL = document.getElementById('fechSegLucro');
    const segC = document.getElementById('fechSegCusto');
    const segI = document.getElementById('fechSegImposto');
    if (segL) segL.style.width = lucroW + '%';
    if (segC) segC.style.width = custoW + '%';
    if (segI) segI.style.width = impostoW + '%';
  }
}

async function sumGastos(ref) {
  // ref pode ser fechamento_id ou project_id
  try {
    const res = await fetch(`tables/age_gastos?limit=500`);
    const data = res.ok ? await res.json() : { data: [] };
    const rows = (data.data || []).filter(g => !g.deleted &&
      (g.fechamento_id === ref || g.project_id === ref));
    return rows.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
  } catch(e) { return 0; }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── Render tabela de gastos ── */
async function renderGastos() {
  const section = document.getElementById('fechGastosSection');
  if (section) section.style.display = '';

  const tbody = document.getElementById('fechGastosBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="table-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

  const pid  = _currentFechData?.project_id;
  const fid  = _currentFechId;

  try {
    const res = await fetch('tables/age_gastos?limit=500');
    const data = res.ok ? await res.json() : { data: [] };
    const gastos = (data.data || []).filter(g => !g.deleted &&
      (fid ? g.fechamento_id === fid : g.project_id === pid));

    if (!gastos.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Nenhum gasto lançado. Clique em "+ Adicionar Gasto".</td></tr>';
      return;
    }

    const catColors = {
      equipe:'#00aaff', equipamento:'#cc44ff', transporte:'#ffcc00',
      locacao:'#ff6600', edicao:'#00ff88', marketing:'#ff6688',
      alimentacao:'#ff9944', hospedagem:'#aaddff', software:'#8855ff', outros:'#aaaaaa'
    };

    tbody.innerHTML = gastos.map(g => {
      const cor = catColors[g.categoria] || '#aaaaaa';
      return `
        <tr>
          <td style="font-weight:600;color:#e4eeff">${g.descricao || '—'}</td>
          <td><span class="badge" style="background:${cor}18;border:1px solid ${cor}44;color:${cor}">${(g.categoria||'outros').toUpperCase()}</span></td>
          <td style="color:#99bbdd">${g.fornecedor || '—'}</td>
          <td style="font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:var(--c-p)">${fmtBRL(g.valor)}</td>
          <td style="font-size:11px;color:#88aacc">${fmtDateShort(g.data_gasto)}</td>
          <td>
            <div class="td-actions">
              <button class="btn-icon" title="Editar" onclick="editGasto('${g.id}')"><i class="fas fa-edit"></i></button>
              <button class="btn-icon danger" title="Excluir" onclick="deleteGasto('${g.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Erro ao carregar gastos.</td></tr>';
  }
}

function showFechEmpty(show) {
  const empty   = document.getElementById('fechEmptyState');
  const summary = document.getElementById('fechSummaryGrid');
  const dist    = document.getElementById('fechDistWrap');
  const section = document.getElementById('fechGastosSection');
  if (empty)   empty.style.display   = show ? '' : 'none';
  if (summary) summary.style.display = show ? 'none' : '';
  if (dist)    dist.style.display    = show ? 'none' : '';
  if (section) section.style.display = show ? 'none' : '';
}

/* ── Modal de fechamento (cabeçalho) ── */
async function openFechamentoModal(fech = null) {
  await loadFechamentoList();
  // Preencher select de projeto no modal
  const projSel = document.getElementById('fechProjectSelect');
  const modalSel = document.getElementById('fechProjeto');
  if (modalSel && projSel) modalSel.innerHTML = projSel.innerHTML;

  if (fech) {
    document.getElementById('modalFechamentoTitle').textContent = 'EDITAR FECHAMENTO';
    document.getElementById('editFechId').value       = fech.id || '';
    document.getElementById('fechProjeto').value      = fech.project_id || '';
    document.getElementById('fechValor').value        = fech.total_value || '';
    document.getElementById('fechImpostoVal').value   = fech.imposto_valor || '';
    document.getElementById('fechImpostoPctInput').value = fech.imposto_pct || '';
    document.getElementById('fechLucroInput').value   = fech.lucro_liquido || '';
    document.getElementById('fechObs').value          = fech.observacoes || '';
  } else {
    document.getElementById('modalFechamentoTitle').textContent = 'NOVO FECHAMENTO';
    document.getElementById('editFechId').value = '';
    // Pre-preencher com projeto selecionado
    if (projSel?.value) document.getElementById('fechProjeto').value = projSel.value;
    // Pre-preencher valor do projeto se já tiver dados
    if (_currentFechData) {
      document.getElementById('fechValor').value      = _currentFechData.total_value || '';
      document.getElementById('fechImpostoVal').value = _currentFechData.imposto_valor || '';
      document.getElementById('fechImpostoPctInput').value = _currentFechData.imposto_pct || '';
    } else {
      document.getElementById('fechValor').value = '';
      document.getElementById('fechImpostoVal').value = '';
      document.getElementById('fechImpostoPctInput').value = '';
    }
    document.getElementById('fechLucroInput').value = '';
    document.getElementById('fechObs').value = '';
  }
  calcFechLucro();
  openModal('modalFechamento');
}

function calcFechLucro() {
  const val     = parseFloat(document.getElementById('fechValor')?.value) || 0;
  const imposto = parseFloat(document.getElementById('fechImpostoVal')?.value) || 0;
  const pctEl   = document.getElementById('fechImpostoPctInput');
  const lucroEl = document.getElementById('fechLucroInput');

  // Atualizar % do imposto
  if (pctEl && val > 0) pctEl.value = (imposto / val * 100).toFixed(2);

  // Lucro = valor - imposto (gastos serão descontados ao salvar)
  if (lucroEl) lucroEl.value = (val - imposto).toFixed(2);
}

function calcFechImpostoFromPct() {
  const val  = parseFloat(document.getElementById('fechValor')?.value) || 0;
  const pct  = parseFloat(document.getElementById('fechImpostoPctInput')?.value) || 0;
  const impEl = document.getElementById('fechImpostoVal');
  if (impEl) impEl.value = (val * pct / 100).toFixed(2);
  calcFechLucro();
}

async function saveFechamento() {
  const id        = document.getElementById('editFechId').value;
  const pid       = document.getElementById('fechProjeto').value;
  const totalVal  = parseFloat(document.getElementById('fechValor').value) || 0;
  const impostoV  = parseFloat(document.getElementById('fechImpostoVal').value) || 0;
  const impostoPct = totalVal > 0 ? (impostoV / totalVal * 100) : 0;
  const obs       = document.getElementById('fechObs').value.trim();

  if (!pid) { showToast('Selecione um projeto', 'fa-exclamation-triangle'); return; }

  // Buscar gastos já lançados para calcular lucro
  const gastos = await sumGastos(id || pid);
  const lucro  = totalVal - impostoV - gastos;

  // Buscar dados do projeto para cache
  const proj = await fetchProject(pid);

  const payload = {
    project_id: pid,
    project_name: proj?.project_name || '',
    client_name: proj?.client_name || '',
    total_value: totalVal,
    imposto_valor: impostoV,
    imposto_pct: impostoPct,
    lucro_liquido: lucro,
    observacoes: obs,
    created_by: currentUser.username
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `tables/age_fechamento/${id}` : 'tables/age_fechamento';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const saved = await res.json();
      _currentFechId   = saved.id;
      _currentFechData = saved;
      closeModal('modalFechamento');
      showToast('Fechamento salvo!', 'fa-check-circle');
      // Atualizar select do projeto para refletir o projeto salvo
      const projSel = document.getElementById('fechProjectSelect');
      if (projSel) { projSel.value = pid; }
      await renderFechSummary();
      await renderGastos();
      showFechEmpty(false);
      // ── SYNC: propagar custo real para age_projects e demais páginas ──
      if (window.SYNC) await window.SYNC.onFechamentoSaved(saved);
    }
  } catch(e) { showToast('Erro ao salvar fechamento', 'fa-exclamation-triangle'); }
}

/* ── Modal de gasto ── */
function openGastoModal() {
  if (!_currentFechData?.project_id && !_currentFechId) {
    showToast('Salve o fechamento primeiro', 'fa-exclamation-triangle'); return;
  }
  document.getElementById('modalGastoTitle').textContent = 'NOVO GASTO';
  document.getElementById('editGastoId').value   = '';
  document.getElementById('gastoDesc').value     = '';
  document.getElementById('gastoCategoria').value = 'outros';
  document.getElementById('gastoFornecedor').value = '';
  document.getElementById('gastoValor').value    = '';
  document.getElementById('gastoData').value     = new Date().toISOString().slice(0, 10);
  openModal('modalGasto');
}

async function editGasto(id) {
  try {
    const res = await fetch(`tables/age_gastos/${id}`);
    if (res.ok) {
      const g = await res.json();
      document.getElementById('modalGastoTitle').textContent = 'EDITAR GASTO';
      document.getElementById('editGastoId').value    = g.id;
      document.getElementById('gastoDesc').value      = g.descricao || '';
      document.getElementById('gastoCategoria').value = g.categoria || 'outros';
      document.getElementById('gastoFornecedor').value= g.fornecedor || '';
      document.getElementById('gastoValor').value     = g.valor || '';
      document.getElementById('gastoData').value      = g.data_gasto || '';
      openModal('modalGasto');
    }
  } catch(e) {}
}

async function saveGasto() {
  const id        = document.getElementById('editGastoId').value;
  const descricao = document.getElementById('gastoDesc').value.trim();
  const categoria = document.getElementById('gastoCategoria').value;
  const fornecedor= document.getElementById('gastoFornecedor').value.trim();
  const valor     = parseFloat(document.getElementById('gastoValor').value) || 0;
  const dataGasto = document.getElementById('gastoData').value;

  if (!descricao || !valor) {
    showToast('Informe descrição e valor do gasto', 'fa-exclamation-triangle'); return;
  }

  // Se não há fechamento salvo ainda, salvar fechamento primeiro
  if (!_currentFechId && _currentFechData) {
    await saveFechamento();
  }

  const payload = {
    fechamento_id: _currentFechId || '',
    project_id: _currentFechData?.project_id || '',
    descricao, categoria, fornecedor, valor,
    data_gasto: dataGasto,
    created_by: currentUser.username
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `tables/age_gastos/${id}` : 'tables/age_gastos';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('modalGasto');
      showToast(id ? 'Gasto atualizado!' : 'Gasto adicionado!', 'fa-check-circle');
      // Recalcular lucro e re-render
      await renderFechSummary();
      await renderGastos();
      // Persistir lucro atualizado no fechamento
      if (_currentFechId) {
        const gastosTotal = await sumGastos(_currentFechId);
        const lucro  = (_currentFechData.total_value||0) - (_currentFechData.imposto_valor||0) - gastosTotal;
        await fetch(`tables/age_fechamento/${_currentFechId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lucro_liquido: lucro })
        });
        // ── SYNC: propagar custo real do gasto para age_projects e dashboard ──
        if (window.SYNC) {
          const fechAtualizado = { ..._currentFechData, lucro_liquido: lucro };
          await window.SYNC.onFechamentoSaved(fechAtualizado, gastosTotal);
        }
      }
    }
  } catch(e) { showToast('Erro ao salvar gasto', 'fa-exclamation-triangle'); }
}

function deleteGasto(id) {
  showConfirm('Excluir este gasto?', async () => {
    try {
      await fetch(`tables/age_gastos/${id}`, { method: 'DELETE' });
      showToast('Gasto excluído', 'fa-trash');
      await renderFechSummary();
      await renderGastos();
      // Atualizar lucro
      if (_currentFechId) {
        const gastosRestantes = await sumGastos(_currentFechId);
        const lucro  = (_currentFechData.total_value||0) - (_currentFechData.imposto_valor||0) - gastosRestantes;
        await fetch(`tables/age_fechamento/${_currentFechId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lucro_liquido: lucro })
        });
        // ── SYNC: propagar custo atualizado ──
        if (window.SYNC) {
          const fechAtualizado = { ..._currentFechData, lucro_liquido: lucro };
          await window.SYNC.onFechamentoSaved(fechAtualizado, gastosRestantes);
        }
      }
    } catch(e) {}
  });
}

// Close modal on outside click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// Keyboard ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});
