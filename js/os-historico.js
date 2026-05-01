/* ============================================================
   AGE OPS — OS-HISTORICO.JS  v3.0
   Banco de dados histórico: 2021–2026 | 122 projetos | 73 clientes
   Dados extraídos diretamente das planilhas Ownage KPIs Dashboard
   ============================================================ */

window.HIST = (() => {
  'use strict';

  const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

  /* Dados reais das planilhas — fonte verdade extraída dos XLSX 2021–2026
     Campos: fat=faturamento, custo=custos, lucro=lucro líquido, n=projetos,
             clients=clientes únicos, newCli=clientes novos, avgNps=NPS médio,
             avgTicket=ticket médio, margem=% margem, peakMonth=mês pico (1-12) */
  const YEAR_SUMMARY = {
    2021: { fat: 67415,  custo: 0,      lucro: 67415,  n: 12, clients: 9,  newCli: 9,  avgNps: 0,   margem: 100,  peakMonth: 11, peakRev: 20000 },
    2022: { fat: 109042, custo: 58835,  lucro: 50207,  n: 25, clients: 22, newCli: 16, avgNps: 0,   margem: 46.1, peakMonth: 11, peakRev: 22550 },
    2023: { fat: 210591, custo: 97431,  lucro: 113160, n: 28, clients: 18, newCli: 10, avgNps: 9.0, margem: 53.7, peakMonth: 9,  peakRev: 38600 },
    2024: { fat: 162440, custo: 77538,  lucro: 84902,  n: 22, clients: 17, newCli: 8,  avgNps: 9.2, margem: 52.3, peakMonth: 6,  peakRev: 32000 },
    2025: { fat: 110190, custo: 0,      lucro: 110190, n: 23, clients: 18, newCli: 7,  avgNps: 0,   margem: 100,  peakMonth: 3,  peakRev: 17400 },
    2026: { fat: 46200,  custo: 19979,  lucro: 26221,  n: 12, clients: 12, newCli: 6,  avgNps: 0,   margem: 56.8, peakMonth: 2,  peakRev: 17000 }
  };

  /* Dados detalhados de segmentos e categorias por ano (das planilhas) */
  const YEAR_SEGMENTS = {
    2021: { 'Videoclipe': 4, 'Satisfaction': 3, 'Visualizer': 3, 'Lyric Video': 1, 'Outros': 1 },
    2022: { 'Videoclipe': 8, 'Satisfaction': 6, 'Lyric Video': 4, 'Visualizer': 3, 'Backstage': 2, 'Outros': 2 },
    2023: { 'Videoclipe': 10, 'Satisfaction': 7, 'Lyric Video': 5, 'Visualizer': 3, 'Evento': 2, 'Backstage': 1 },
    2024: { 'Videoclipe': 7, 'Satisfaction': 5, 'Lyric Video': 4, 'Evento': 3, 'Visualizer': 2, 'Outros': 1 },
    2025: { 'Videoclipe': 8, 'Satisfaction': 6, 'Lyric Video': 4, 'Evento': 3, 'Backstage': 2 },
    2026: { 'Videoclipe': 5, 'Satisfaction': 3, 'Lyric Video': 2, 'Evento': 1, 'Outros': 1 }
  };

  /* Top clientes históricos (dos dados importados) */
  const TOP_CLIENTS_HIST = [
    { name: 'JAY P',          value: 243600, count: 27, years: [2022,2023,2024,2025] },
    { name: 'UNIVERSAL MUSIC', value: 105100, count: 5,  years: [2022,2023,2024] },
    { name: 'Giana Mello',     value: 96100,  count: 12, years: [2022,2023,2024,2025,2026] },
    { name: 'LOU GARCIA',      value: 86900,  count: 4,  years: [2023,2024] },
    { name: 'KG NETWORK',      value: 69550,  count: 6,  years: [2022,2023,2024,2025] }
  ];

  let _allProjects  = [];
  let _selectedYear = null;
  let _charts       = {};

  /* ── helpers ── */
  function fmtBRL(v) {
    return (parseFloat(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
  }
  function getProfitColor(pct) {
    if (pct >= 65) return '#00ff88';
    if (pct >= 45) return '#88ff44';
    if (pct >= 30) return '#ffcc00';
    if (pct >= 15) return '#ff8800';
    return '#ff4444';
  }
  function destroyChart(id) {
    if (_charts[id]) { try { _charts[id].destroy(); } catch(e){} delete _charts[id]; }
  }
  function kpiCard(icon, label, value, color) {
    color = color || '#00aaff';
    return `<div class="hist-kpi-card">
      <div class="hist-kpi-icon" style="color:${color}"><i class="fas ${icon}"></i></div>
      <div class="hist-kpi-body">
        <div class="hist-kpi-label">${label}</div>
        <div class="hist-kpi-value" style="color:${color}">${value}</div>
      </div>
    </div>`;
  }

  /* ════════════════════════════════════════════════════════
     INICIALIZAÇÃO
  ════════════════════════════════════════════════════════ */
  async function onNavigate() {
    await loadAllProjects();
    renderYearTabs();
    renderOverallReport();
    selectYear(2026);
  }

  async function loadAllProjects() {
    try {
      // Buscar histórico com paginação (pode ter mais de 500 registros se houver duplicatas)
      let histProjs = [];
      let page = 1;
      while (true) {
        const r = await fetch(`tables/age_hist_projects?limit=200&page=${page}`);
        if (!r.ok) break;
        const d = await r.json();
        const rows = (d.data || []).filter(p => !p.deleted);
        histProjs = histProjs.concat(rows);
        if (rows.length < 200 || histProjs.length >= d.total) break;
        page++;
      }

      // ── DEDUPLICAÇÃO: manter apenas um registro por (year + client_name + project_name) ──
      // Isso resolve o problema de dados duplicados no banco
      const seen   = new Map();
      const unique = [];
      for (const p of histProjs) {
        const yr  = parseInt(p.year) || 0;
        const key = `${yr}|${(p.client_name||'').toLowerCase().trim()}|${(p.project_name||'').toLowerCase().trim()}`;
        if (seen.has(key)) continue; // pular duplicata
        seen.set(key, true);
        unique.push(p);
      }
      if (histProjs.length > unique.length) {
        console.warn(`[HIST] Deduplicação: ${histProjs.length} → ${unique.length} registros únicos`);
      }
      histProjs = unique;

      // Buscar projetos ativos + fechamentos + gastos em paralelo
      const [projRes, fechRes, gastosRes] = await Promise.all([
        fetch('tables/age_projects?limit=300'),
        fetch('tables/age_fechamento?limit=300'),
        fetch('tables/age_gastos?limit=1000')
      ]);

      const projData   = projRes.ok   ? await projRes.json()   : { data: [] };
      const fechData   = fechRes.ok   ? await fechRes.json()   : { data: [] };
      const gastosData = gastosRes.ok ? await gastosRes.json() : { data: [] };

      const activeProj = (projData.data   || []).filter(p => !p.deleted);
      const fechList   = (fechData.data   || []).filter(f => !f.deleted);
      const gastosList = (gastosData.data || []).filter(g => !g.deleted);

      // Helper: custo real de um projeto via fechamento
      function getCustoReal(clientName, projectName, projectId) {
        const fech = fechList.find(f =>
          f.project_id === projectId ||
          ((f.client_name||'').toLowerCase()  === (clientName||'').toLowerCase() &&
           (f.project_name||'').toLowerCase() === (projectName||'').toLowerCase())
        );
        if (!fech) return null;
        const gastosProj = gastosList
          .filter(g => g.fechamento_id === fech.id || g.project_id === fech.project_id)
          .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
        const imposto = parseFloat(fech.imposto_valor) || 0;
        return {
          cost:       gastosProj + imposto,
          totalValue: parseFloat(fech.total_value) || 0,
          imposto,
          gastos:     gastosProj,
          fechId:     fech.id
        };
      }

      // Enriquecer hist_projects com custos reais do fechamento
      const enrichedHist = histProjs.map(h => {
        const real = getCustoReal(h.client_name, h.project_name, null);
        if (!real || real.cost === 0) return h;
        const val    = real.totalValue || parseFloat(h.value) || 0;
        const profit = val - real.cost;
        const marg   = val > 0 ? (profit / val * 100) : 0;
        return {
          ...h,
          value:      val,
          cost:       real.cost,
          profit:     profit,
          margin_pct: parseFloat(marg.toFixed(2)),
          _enriched:  true
        };
      });

      // Adicionar projetos ativos CONCLUÍDOS que não estão no histórico
      const curYear = new Date().getFullYear();
      const newEntries = [];
      for (const p of activeProj.filter(ap => ap.status === 'concluido')) {
        const payDate = p.payment_date || p.project_date || '';
        const year    = payDate ? new Date(payDate + 'T00:00:00').getFullYear() : curYear;
        const month   = payDate ? new Date(payDate + 'T00:00:00').getMonth() + 1 : 0;

        const already = enrichedHist.find(h =>
          h.year == year &&
          (h.client_name||'').toLowerCase()  === (p.client_name||'').toLowerCase() &&
          (h.project_name||'').toLowerCase() === (p.project_name||'').toLowerCase()
        );
        if (already) continue;

        const real   = getCustoReal(p.client_name, p.project_name, p.id);
        const cost   = real ? real.cost : (parseFloat(p.cost) || 0);
        const val    = real ? (real.totalValue || parseFloat(p.total_value) || 0) : (parseFloat(p.total_value) || 0);
        const profit = val - cost;
        const marg   = val > 0 ? (profit / val * 100) : 0;

        newEntries.push({
          id:            `active_${p.id}`,
          year, month,
          client_name:   p.client_name  || '?',
          project_name:  p.project_name || '?',
          value:  val, cost, profit,
          margin_pct: parseFloat(marg.toFixed(2)),
          nps:           parseFloat(p.nps) || 0,
          category:      p.category || 'producao',
          status:        'concluido',
          is_new_client: p.is_new_client === true || p.is_new_client === 'true',
          _fromActive:   true
        });
      }

      _allProjects = [...enrichedHist, ...newEntries];
      console.log(`[HIST] Carregados: ${_allProjects.length} projetos únicos (hist: ${enrichedHist.length}, ativos extras: ${newEntries.length})`);
    } catch(e) {
      console.error('HIST load error:', e);
      _allProjects = [];
    }
  }

  /* ════════════════════════════════════════════════════════
     ABAS DE ANO
  ════════════════════════════════════════════════════════ */
  function renderYearTabs() {
    const container = document.getElementById('histYearTabs');
    if (!container) return;

    container.innerHTML = YEARS.map(y => {
      const ys  = YEAR_SUMMARY[y];
      const yp  = _allProjects.filter(p => p.year == y);
      /* Sempre usar YEAR_SUMMARY como fonte verdade para faturamento nos tabs */
      const thisFat = ys.fat;
      const count   = yp.length || ys.n;
      /* Crescimento YoY sempre de YEAR_SUMMARY para consistência */
      const prevYs  = YEAR_SUMMARY[y-1];
      const growth  = prevYs && prevYs.fat > 0 ? ((thisFat - prevYs.fat)/prevYs.fat*100) : null;
      const gStr    = growth !== null
        ? `<div class="hist-tab-growth ${growth>=0?'up':'down'}">${growth>=0?'▲':'▼'} ${Math.abs(growth).toFixed(0)}%</div>`
        : '';
      const isCur = y === 2026;
      return `
        <div class="hist-year-tab ${y===_selectedYear?'active':''} ${isCur?'current-year':''}"
             onclick="HIST.selectYear(${y})">
          <div class="hist-tab-year">${y}</div>
          <div class="hist-tab-rev">${fmtBRL(thisFat)}</div>
          <div class="hist-tab-count">${count} proj.</div>
          ${gStr}
          ${isCur ? '<div class="hist-tab-badge">EM CURSO</div>' : ''}
        </div>`;
    }).join('');
  }

  /* ════════════════════════════════════════════════════════
     SELECIONAR ANO
  ════════════════════════════════════════════════════════ */
  function selectYear(year) {
    _selectedYear = year;
    document.querySelectorAll('.hist-year-tab').forEach(t => t.classList.remove('active'));
    const tabs = document.querySelectorAll('.hist-year-tab');
    const idx  = YEARS.indexOf(year);
    if (tabs[idx]) tabs[idx].classList.add('active');
    const yearPanel    = document.getElementById('histYearPanel');
    const overallPanel = document.getElementById('histOverallPanel');
    if (yearPanel)    yearPanel.style.display    = '';
    if (overallPanel) overallPanel.style.display = 'none';
    renderYearDashboard(year);
  }

  function showOverall() {
    _selectedYear = null;
    document.querySelectorAll('.hist-year-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('histYearPanel').style.display    = 'none';
    document.getElementById('histOverallPanel').style.display = '';
  }

  /* ════════════════════════════════════════════════════════
     DASHBOARD DE UM ANO
  ════════════════════════════════════════════════════════ */
  function renderYearDashboard(year) {
    const projects = _allProjects.filter(p => p.year == year);
    const panel    = document.getElementById('histYearPanel');
    if (!panel) return;

    const ys0 = YEAR_SUMMARY[year];

    /* ── Totais — YEAR_SUMMARY é sempre a fonte verdade das planilhas ──
       Os dados do banco são usados para contexto/detalhes (clientes, meses, etc.)
       mas os totais financeiros vêm do YEAR_SUMMARY para garantir precisão */
    const totalRev  = ys0.fat;
    const totalCost = ys0.custo;
    const totalPro  = ys0.lucro;
    const avgMargin = ys0.custo > 0 && ys0.fat > 0 ? (ys0.lucro / ys0.fat * 100) : null;

    const withNps   = projects.filter(p=>parseFloat(p.nps)>0);
    const avgNps    = withNps.length
      ? withNps.reduce((s,p)=>s+(parseFloat(p.nps)||0),0)/withNps.length
      : ys0.avgNps;
    /* projCount: usar YEAR_SUMMARY se o banco tiver mais projetos (duplicados) ou menos */
    const dbCount   = projects.length;
    const projCount = (dbCount > 0 && dbCount <= ys0.n * 1.5) ? Math.min(dbCount, ys0.n) : ys0.n;
    const ticket    = projCount > 0 ? totalRev / projCount : 0;
    const newCliDB  = projects.filter(p=>p.is_new_client===true||p.is_new_client==='Sim'||p.is_new_client==='true').length;
    const newCli    = newCliDB > 0 ? newCliDB : ys0.newCli;
    const isCurrent = year === 2026;
    const semCusto  = ys0.custo === 0; /* 2021 e 2025: custo não registrado nas planilhas */

    /* meses — agregar do banco */
    const monthMap = {}, costMMap = {};
    projects.forEach(p => {
      const m = parseInt(p.month)||0;
      if (!m) return;
      monthMap[m]  = (monthMap[m]||0)  + (parseFloat(p.value)||0);
      costMMap[m]  = (costMMap[m]||0)  + (parseFloat(p.cost)||0);
    });
    const monthVals  = Object.values(monthMap);
    /* Média mensal: usar total de YEAR_SUMMARY dividido por meses com dados ou por 12 */
    const activeMonths = monthVals.length || 12;
    const avgMonthly   = totalRev / activeMonths;
    const peakEntry    = Object.entries(monthMap).sort((a,b)=>b[1]-a[1])[0];

    /* clientes */
    const clientMap = {};
    projects.forEach(p => {
      const c = p.client_name||'?';
      if (!clientMap[c]) clientMap[c]={value:0,count:0,profit:0};
      clientMap[c].value  += parseFloat(p.value)||0;
      clientMap[c].count  ++;
      clientMap[c].profit += parseFloat(p.profit)||0;
    });
    const topClients = Object.entries(clientMap).sort((a,b)=>b[1].value-a[1].value).slice(0,8);

    /* categorias */
    const catMap = {};
    projects.forEach(p => { const c=p.category||'outro'; catMap[c]=(catMap[c]||0)+(parseFloat(p.value)||0); });

    /* segmentos — usa dados reais do DB ou fallback das planilhas */
    const segMap = {};
    projects.forEach(p => { const s=p.segment||''; if(s) segMap[s]=(segMap[s]||0)+1; });
    /* fallback: se não houver segmentos no DB, usa os dados das planilhas */
    if (Object.keys(segMap).length === 0 && YEAR_SEGMENTS[year]) {
      Object.assign(segMap, YEAR_SEGMENTS[year]);
    }

    /* gráfico mensal */
    const MN = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const cLabels=[], cRev=[], cCost=[], cProfit=[];
    for (let m=1; m<=12; m++) {
      if (monthMap[m]!==undefined) {
        cLabels.push(MN[m-1]);
        cRev.push(monthMap[m]);
        cCost.push(costMMap[m]||0);
        cProfit.push((monthMap[m]||0)-(costMMap[m]||0));
      }
    }

    /* YoY — sempre calculado de YEAR_SUMMARY para consistência */
    const prevSum   = YEAR_SUMMARY[year-1];
    const growthYoY = prevSum && prevSum.fat > 0 ? ((ys0.fat - prevSum.fat)/prevSum.fat*100) : null;

    const MN2 = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const ys   = ys0; /* alias para YEAR_SUMMARY[year] */

    /* Contexto especial por ano */
    const yearContext = {
      2021: { note: 'Primeiro ano completo de operação — sem registro de custos nas planilhas.', color: '#88aacc' },
      2022: { note: 'Ano mais intenso em volume: 25 projetos, maior operação da história. Custo elevado: 54% do faturamento.', color: '#ffcc00' },
      2023: { note: '★ ANO RECORDE — R$210.591. Maior NPS médio e melhor margem operacional com custo registrado.', color: '#00ff88' },
      2024: { note: 'Queda de 22.9% vs 2023. JAY P concentrou grande parte da receita. NPS médio: 9.2.', color: '#ff8800' },
      2025: { note: 'Queda de 32.1% vs 2024. Custos não registrados nas planilhas. 23 projetos.', color: '#ff6655' },
      2026: { note: 'Q1 completo: 12 projetos, R$46.200. Projeção anual linear: ~R$184.800.', color: '#cc44ff' }
    };
    const ctx = yearContext[year] || {};

    panel.innerHTML = `
      <div class="hist-year-header">
        <div class="hist-year-title">
          <span class="hist-year-num">${year}</span>
          ${isCurrent ? '<span class="hist-year-badge-live">EM CURSO</span>' : '<span class="hist-year-badge-done">CONCLUÍDO</span>'}
          ${growthYoY !== null ? `<span class="hist-yoy ${growthYoY>=0?'up':'down'}">${growthYoY>=0?'▲':'▼'} ${Math.abs(growthYoY).toFixed(1)}% vs ${year-1}</span>` : ''}
          ${year===2023 ? '<span style="font-size:11px;color:#ffcc00;background:rgba(255,204,0,.1);border:1px solid #ffcc0044;padding:3px 10px;border-radius:12px;margin-left:6px">★ ANO RECORDE</span>' : ''}
          ${(ys.custo===0 && year!==2026) ? '<span style="font-size:10px;color:#ff8800;background:rgba(255,136,0,.1);border:1px solid #ff880044;padding:2px 8px;border-radius:10px;margin-left:6px"><i class="fas fa-exclamation-triangle"></i> SEM CUSTOS</span>' : ''}
        </div>
        <div class="hist-year-subtitle">
          ${projCount} projetos &middot; ${Object.keys(clientMap).length || ys.clients} clientes &middot; ${newCli} novos &middot; ticket médio ${fmtBRL(ticket)}
        </div>
        ${ctx.note ? `<div class="hist-year-context" style="color:${ctx.color}">${ctx.note}</div>` : ''}
      </div>

      <div class="hist-kpi-row">
        ${kpiCard('fa-dollar-sign','FATURAMENTO',fmtBRL(totalRev),'#00aaff')}
        ${semCusto
          ? kpiCard('fa-chart-pie','LUCRO','N/D','#334455')
          : kpiCard('fa-chart-pie','LUCRO',fmtBRL(totalPro),getProfitColor(avgMargin||0))}
        ${semCusto
          ? kpiCard('fa-percentage','MARGEM','N/D','#334455')
          : kpiCard('fa-percentage','MARGEM',(avgMargin!==null?avgMargin:ys0.margem).toFixed(1)+'%',getProfitColor(avgMargin!==null?avgMargin:ys0.margem))}
        ${kpiCard('fa-calendar-alt','MÉDIA MENSAL',fmtBRL(avgMonthly),'#cc44ff')}
        ${kpiCard('fa-receipt','TICKET MÉDIO',fmtBRL(ticket),'#ffcc00')}
        ${(avgNps>0 || ys0.avgNps>0) ? kpiCard('fa-star','NPS MÉDIO',(avgNps||ys0.avgNps).toFixed(1)+' ★',(avgNps||ys0.avgNps)>=9?'#00ff88':(avgNps||ys0.avgNps)>=7?'#ffcc00':'#ff8800') : kpiCard('fa-star','NPS MÉDIO','N/A','#556677')}
        ${kpiCard('fa-user-plus','NOVOS CLIENTES',newCli,'#ff6600')}
        ${kpiCard('fa-folder','PROJETOS',projCount,'#0088ff')}
        ${semCusto
          ? kpiCard('fa-coins','CUSTO','Sem registro','#445566')
          : kpiCard('fa-coins','CUSTO',fmtBRL(totalCost),'#ff4444')}
        ${peakEntry ? kpiCard('fa-crown','MÊS PICO',MN[parseInt(peakEntry[0])-1]+' · '+fmtBRL(peakEntry[1]),'#ffdd00') : kpiCard('fa-crown','MÊS PICO',MN[(ys0.peakMonth||1)-1]+' · '+(ys0.peakRev?fmtBRL(ys0.peakRev):'—'),'#ffdd00')}
        ${isCurrent ? kpiCard('fa-rocket','PROJEÇÃO 2026',fmtBRL(Math.round((ys0.fat/3)*12)),'#88ff44') : ''}
      </div>

      <div class="hist-charts-row">
        <div class="hist-chart-panel" style="flex:1.6">
          <div class="hist-chart-header"><i class="fas fa-chart-bar"></i> FATURAMENTO POR MÊS — ${year}</div>
          <div style="height:230px"><canvas id="histChartMonthly"></canvas></div>
        </div>
        <div class="hist-chart-panel" style="flex:1">
          <div class="hist-chart-header"><i class="fas fa-chart-pie"></i> CATEGORIAS</div>
          <div style="height:230px"><canvas id="histChartCat"></canvas></div>
        </div>
      </div>

      ${totalCost>0 ? `
      <div class="hist-chart-panel">
        <div class="hist-chart-header"><i class="fas fa-chart-line"></i> LUCRO × CUSTO POR MÊS</div>
        <div style="height:200px"><canvas id="histChartProfitCost"></canvas></div>
      </div>` : ''}

      <div class="hist-chart-panel">
        <div class="hist-chart-header"><i class="fas fa-trophy"></i> RANKING CLIENTES — ${year}</div>
        <div class="hist-ranking-grid">
          ${topClients.map(([name,d],i) => {
            const pct  = totalRev>0?(d.value/totalRev*100):0;
            const marg = d.value>0?(d.profit/d.value*100):0;
            const md   = ['🥇','🥈','🥉'];
            return `<div class="hist-rank-item">
              <div class="hist-rank-pos">${md[i]||`${i+1}°`}</div>
              <div class="hist-rank-body">
                <div class="hist-rank-name">${name}</div>
                <div class="hist-rank-bar-wrap"><div class="hist-rank-bar" style="width:${pct.toFixed(1)}%"></div></div>
              </div>
              <div class="hist-rank-meta">
                <div class="hist-rank-value">${fmtBRL(d.value)}</div>
                <div class="hist-rank-pct">${pct.toFixed(0)}% · ${d.count}p${marg>0?' · '+marg.toFixed(0)+'%mg':''}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      ${Object.keys(segMap).length>0 ? `
      <div class="hist-chart-panel">
        <div class="hist-chart-header"><i class="fas fa-tags"></i> SEGMENTOS — ${year}</div>
        <div class="hist-seg-grid">
          ${Object.entries(segMap).sort((a,b)=>b[1]-a[1]).map(([seg,count]) =>
            `<div class="hist-seg-item"><span class="hist-seg-name">${seg}</span><span class="hist-seg-count">${count}</span></div>`
          ).join('')}
        </div>
      </div>` : ''}

      <div class="hist-chart-panel">
        <div class="hist-chart-header"><i class="fas fa-list"></i> TODOS OS PROJETOS — ${year}</div>
        <div class="table-wrap">
          <table class="hud-table">
            <thead>
              <tr><th>CLIENTE</th><th>PROJETO</th><th>SEGMENTO</th><th>MÊS</th><th>FATURAMENTO</th><th>CUSTO</th><th>MARGEM</th><th>NPS</th><th>NOVO?</th></tr>
            </thead>
            <tbody>
              ${projects.sort((a,b)=>(a.month||0)-(b.month||0)).map(p => {
                const mg   = parseFloat(p.margin_pct)||0;
                const mc   = getProfitColor(mg);
                const isN  = p.is_new_client===true||p.is_new_client==='Sim'||p.is_new_client==='true';
                const npsV = parseFloat(p.nps)||0;
                return `<tr>
                  <td><b>${p.client_name||'—'}</b></td>
                  <td>${p.project_name||'—'}</td>
                  <td><span style="color:#88aacc;font-size:10px">${p.segment||p.category||'—'}</span></td>
                  <td>${MN2[p.month]||p.month||'—'}</td>
                  <td><b>${fmtBRL(p.value)}</b></td>
                  <td style="color:#ff6655">${p.cost>0?fmtBRL(p.cost):'—'}</td>
                  <td style="color:${mc};font-weight:700">${mg>0?mg.toFixed(1)+'%':'—'}</td>
                  <td>${npsV>0?`<span style="color:${npsV>=9?'#00ff88':npsV>=7?'#ffcc00':'#ff4444'}">${npsV.toFixed(1)}★</span>`:'—'}</td>
                  <td>${isN?'<span style="color:#ff8800;font-size:10px">✦ NOVO</span>':'<span style="color:#445566;font-size:10px">—</span>'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => {
      renderYearChartMonthly(cLabels, cRev);
      renderYearChartCat(catMap);
      if (totalCost>0) renderProfitCostChart(cLabels, cProfit, cCost);
    }, 50);
  }

  function renderYearChartMonthly(labels, values) {
    destroyChart('histChartMonthly');
    const canvas = document.getElementById('histChartMonthly');
    if (!canvas||!labels.length) return;
    const mx = Math.max(...values);
    _charts['histChartMonthly'] = new Chart(canvas.getContext('2d'), {
      type:'bar',
      data:{ labels, datasets:[{
        label:'Faturamento', data:values,
        backgroundColor: values.map(v=>v===mx?'rgba(0,255,136,0.35)':'rgba(0,170,255,0.2)'),
        borderColor:     values.map(v=>v===mx?'#00ff88':'#00aaff'),
        borderWidth:2, borderRadius:6
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>' '+fmtBRL(c.raw)}} },
        scales:{
          x:{ticks:{color:'rgba(180,200,220,.7)',font:{family:'Share Tech Mono',size:9}},grid:{color:'rgba(255,255,255,.04)'}},
          y:{ticks:{color:'rgba(180,200,220,.7)',font:{family:'Share Tech Mono',size:9},callback:v=>'R$'+Math.round(v/1000)+'k'},grid:{color:'rgba(255,255,255,.06)'}}
        }
      }
    });
  }

  function renderYearChartCat(catMap) {
    destroyChart('histChartCat');
    const canvas = document.getElementById('histChartCat');
    if (!canvas) return;
    const entries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
    const colors  = ['#00aaff','#ff4466','#ffcc00','#00ff88','#cc44ff','#ff6600','#00f5ff','#ff6688'];
    _charts['histChartCat'] = new Chart(canvas.getContext('2d'), {
      type:'doughnut',
      data:{ labels:entries.map(([k])=>k.toUpperCase()), datasets:[{data:entries.map(([,v])=>v),backgroundColor:colors,borderColor:'#0a0e1a',borderWidth:3}]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom',labels:{color:'rgba(180,200,220,.8)',font:{family:'Share Tech Mono',size:9},padding:8}},
          tooltip:{callbacks:{label:c=>' '+fmtBRL(c.raw)}}
        }
      }
    });
  }

  function renderProfitCostChart(labels, profitData, costData) {
    destroyChart('histChartProfitCost');
    const canvas = document.getElementById('histChartProfitCost');
    if (!canvas||!labels.length) return;
    _charts['histChartProfitCost'] = new Chart(canvas.getContext('2d'), {
      type:'bar',
      data:{
        labels,
        datasets:[
          {label:'Lucro',data:profitData,backgroundColor:'rgba(0,255,136,0.25)',borderColor:'#00ff88',borderWidth:2,borderRadius:4},
          {label:'Custo',data:costData,  backgroundColor:'rgba(255,68,68,0.2)',  borderColor:'#ff4444',borderWidth:2,borderRadius:4}
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{labels:{color:'rgba(180,200,220,.8)',font:{family:'Share Tech Mono',size:9}}},
          tooltip:{callbacks:{label:c=>' '+fmtBRL(c.raw)}}
        },
        scales:{
          x:{ticks:{color:'rgba(180,200,220,.7)',font:{family:'Share Tech Mono',size:9}},grid:{color:'rgba(255,255,255,.04)'}},
          y:{ticks:{color:'rgba(180,200,220,.7)',font:{family:'Share Tech Mono',size:9},callback:v=>'R$'+Math.round(v/1000)+'k'},grid:{color:'rgba(255,255,255,.06)'}}
        }
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     RELATÓRIO GERAL — TODOS OS ANOS
  ════════════════════════════════════════════════════════ */
  function renderOverallReport() {
    const panel = document.getElementById('histOverallPanel');
    if (!panel) return;

    const allP = _allProjects;

    /* ── Totais gerais usando YEAR_SUMMARY como fonte verdade ── */
    const totalRev  = Object.values(YEAR_SUMMARY).reduce((s,y)=>s+y.fat,0);
    const totalCost = Object.values(YEAR_SUMMARY).reduce((s,y)=>s+y.custo,0);
    const totalPro  = Object.values(YEAR_SUMMARY).reduce((s,y)=>s+y.lucro,0);
    /* Margem global só sobre anos com custo registrado */
    const revComCusto  = Object.values(YEAR_SUMMARY).filter(y=>y.custo>0).reduce((s,y)=>s+y.fat,0);
    const lucrComCusto = Object.values(YEAR_SUMMARY).filter(y=>y.custo>0).reduce((s,y)=>s+y.lucro,0);
    const avgMargin = revComCusto > 0 ? (lucrComCusto / revComCusto * 100) : 0;

    const withNps   = allP.filter(p=>parseFloat(p.nps)>0);
    const avgNps    = withNps.length ? withNps.reduce((s,p)=>s+(parseFloat(p.nps)||0),0)/withNps.length : 0;
    const totalN    = allP.length || 122;

    const yearData = YEARS.map(y => {
      const yp  = allP.filter(p=>p.year==y);
      /* Usar YEAR_SUMMARY como fonte verdade para faturamento e custo:
         O DB pode ter custo=0 para 2021/2025 por falta de registro nas planilhas */
      const ys  = YEAR_SUMMARY[y];
      const rev = yp.length > 0 ? yp.reduce((s,p)=>s+(parseFloat(p.value)||0),0) : ys.fat;
      /* Custo: usar YEAR_SUMMARY pois é a fonte verdade das planilhas */
      const cst = ys.custo; /* 0 para 2021 e 2025 = sem registro real */
      const pro = ys.lucro; /* Lucro conforme planilha */
      const mg  = cst > 0 && rev > 0 ? (pro/rev*100) : (cst===0 && rev>0 ? null : 0);
      const n   = yp.length || ys.n;
      const cli = yp.length > 0 ? [...new Set(yp.map(p=>p.client_name))].length : ys.clients;
      return {year:y, count:n, rev, cost:cst, pro, margin:mg, clients:cli, semCusto: cst===0};
    });

    const growthRows = yearData.map((d,i) => {
      const g = i>0&&yearData[i-1].rev>0 ? ((d.rev-yearData[i-1].rev)/yearData[i-1].rev*100) : null;
      return {...d, growth:g};
    });

    /* clientes históricos */
    const cliMap = {};
    allP.forEach(p => {
      const c=p.client_name||'?';
      if(!cliMap[c]) cliMap[c]={value:0,count:0,years:new Set(),profit:0};
      cliMap[c].value  += parseFloat(p.value)||0;
      cliMap[c].count  ++;
      cliMap[c].profit += parseFloat(p.profit)||0;
      cliMap[c].years.add(p.year);
    });
    const topCli = Object.entries(cliMap).sort((a,b)=>b[1].value-a[1].value).slice(0,10);

    /* categorias globais */
    const allCatMap = {};
    allP.forEach(p=>{ const c=p.category||'outro'; allCatMap[c]=(allCatMap[c]||0)+(parseFloat(p.value)||0); });

    /* CAGR */
    const cagr = YEAR_SUMMARY[2021].fat>0 ? ((Math.pow(totalRev/YEAR_SUMMARY[2021].fat,1/5)-1)*100) : 0;

    /* diagnóstico */
    const diags = buildStrategicDiag(yearData, cliMap, totalRev, avgMargin, avgNps);

    const MN2 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    panel.innerHTML = `
      <div class="hist-overall-header">
        <div class="hist-year-title">
          <span class="hist-year-num" style="font-size:20px">RELATÓRIO GERAL</span>
          <span class="hist-year-badge-done">2021–2026</span>
        </div>
        <div class="hist-year-subtitle">
          ${totalN} projetos históricos &middot; ${Object.keys(cliMap).length||73} clientes &middot; 5 anos &middot; CAGR ${cagr.toFixed(1)}%/ano
        </div>
      </div>

      <div class="hist-kpi-row">
        ${kpiCard('fa-dollar-sign','FATURAMENTO TOTAL',fmtBRL(totalRev),'#00aaff')}
        ${kpiCard('fa-chart-pie','LUCRO TOTAL',fmtBRL(totalPro),'#00ff88')}
        ${kpiCard('fa-percentage','MARGEM GLOBAL',avgMargin.toFixed(1)+'%',getProfitColor(avgMargin))}
        ${kpiCard('fa-star','NPS MÉDIO',avgNps>0?avgNps.toFixed(1)+' ★':'—','#ffcc00')}
        ${kpiCard('fa-folder-open','TOTAL PROJ.',totalN,'#cc44ff')}
        ${kpiCard('fa-users','CLIENTES',Object.keys(cliMap).length||73,'#ff6600')}
        ${kpiCard('fa-trending-up','CAGR RECEITA',cagr.toFixed(1)+'%/ano',cagr>20?'#00ff88':cagr>10?'#ffcc00':'#ff4444')}
        ${kpiCard('fa-coins','CUSTO TOTAL',fmtBRL(totalCost),'#ff4444')}
      </div>

      <!-- Comparativo anual -->
      <div class="hist-chart-panel">
        <div class="hist-chart-header"><i class="fas fa-table"></i> COMPARATIVO ANUAL — EVOLUÇÃO DA AGE 2021–2026</div>
        <div class="table-wrap">
          <table class="hud-table">
            <thead><tr><th>ANO</th><th>PROJ.</th><th>CLIENTES</th><th>FATURAMENTO</th><th>CUSTO</th><th>LUCRO</th><th>MARGEM</th><th>vs ANO ANT.</th></tr></thead>
            <tbody>
              ${growthRows.map(d => {
                const gc   = d.growth===null?'#556':d.growth>=0?'#00ff88':'#ff4444';
                const gTxt = d.growth===null?'—':`${d.growth>=0?'▲':'▼'} ${Math.abs(d.growth).toFixed(1)}%`;
                const tag  = d.year===2023?'<span style="font-size:9px;color:#ffcc00;margin-left:4px">★REC</span>':
                             d.year===2021?'<span style="font-size:9px;color:#556;margin-left:4px">①</span>':'';
                return `<tr class="${d.year===2026?'tr-highlight':''}">
                  <td><b style="color:#00aaff;font-family:Orbitron,sans-serif">${d.year}${tag}</b></td>
                  <td>${d.count}</td><td>${d.clients}</td>
                  <td><b>${fmtBRL(d.rev)}</b></td>
                  <td style="color:#ff6655">${d.semCusto?'<span style="color:#445566;font-size:10px">sem registro</span>':fmtBRL(d.cost)}</td>
                  <td style="color:#00ff88">${d.semCusto?'<span style="color:#445566;font-size:10px">—</span>':fmtBRL(d.pro)}</td>
                  <td style="color:${d.margin!==null?getProfitColor(d.margin):'#445566'}">${d.margin!==null?d.margin.toFixed(1)+'%':'N/D'}</td>
                  <td style="color:${gc};font-weight:700">${gTxt}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="hist-charts-row">
        <div class="hist-chart-panel" style="flex:1.5">
          <div class="hist-chart-header"><i class="fas fa-chart-line"></i> EVOLUÇÃO FATURAMENTO / LUCRO / CUSTO</div>
          <div style="height:260px"><canvas id="histChartOverallLine"></canvas></div>
        </div>
        <div class="hist-chart-panel" style="flex:1">
          <div class="hist-chart-header"><i class="fas fa-chart-pie"></i> MIX DE SERVIÇOS (2021–2026)</div>
          <div style="height:260px"><canvas id="histChartOverallCat"></canvas></div>
        </div>
      </div>

      <!-- Top clientes -->
      <div class="hist-chart-panel">
        <div class="hist-chart-header"><i class="fas fa-trophy"></i> TOP 10 CLIENTES — HISTÓRICO COMPLETO</div>
        <div class="hist-ranking-grid">
          ${topCli.map(([name,d],i) => {
            const pct  = totalRev>0?(d.value/totalRev*100):0;
            const marg = d.value>0?(d.profit/d.value*100):0;
            const yrs  = [...d.years].sort().join(' · ');
            const md   = ['🥇','🥈','🥉'];
            return `<div class="hist-rank-item">
              <div class="hist-rank-pos">${md[i]||`${i+1}°`}</div>
              <div class="hist-rank-body">
                <div class="hist-rank-name">${name}</div>
                <div class="hist-rank-sub">${yrs} · ${d.count} proj.${marg>0?' · '+marg.toFixed(0)+'%mg':''}</div>
                <div class="hist-rank-bar-wrap"><div class="hist-rank-bar" style="width:${Math.min(100,pct*1.8).toFixed(1)}%"></div></div>
              </div>
              <div class="hist-rank-meta">
                <div class="hist-rank-value">${fmtBRL(d.value)}</div>
                <div class="hist-rank-pct">${pct.toFixed(1)}%</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Diagnóstico estratégico -->
      <div class="hist-chart-panel">
        <div class="hist-chart-header"><i class="fas fa-brain"></i> DIAGNÓSTICO ESTRATÉGICO — 5 ANOS DE AGE</div>
        <div class="hist-diag-grid">
          ${diags.map(d=>`
            <div class="hist-diag-card hist-diag-${d.level}">
              <div class="hist-diag-icon"><i class="fas ${d.icon}"></i></div>
              <div class="hist-diag-body">
                <div class="hist-diag-title">${d.title}</div>
                <div class="hist-diag-msg">${d.msg}</div>
              </div>
              <div class="hist-diag-badge">${d.level==='critical'?'CRÍTICO':d.level==='warn'?'ATENÇÃO':'POSITIVO'}</div>
            </div>`).join('')}
        </div>
      </div>
    `;

    setTimeout(() => {
      renderOverallLineChart(yearData);
      renderOverallCatChart(allCatMap);
    }, 50);
  }

  /* ── Diagnóstico estratégico com dados reais das planilhas ── */
  function buildStrategicDiag(yearData, clientMap, totalRev, avgMargin, avgNps) {
    const diags = [];
    const numClients = Object.keys(clientMap).length || 73;

    /* 1. Tendência geral 2021→2026 */
    const fat23 = YEAR_SUMMARY[2023].fat, fat24 = YEAR_SUMMARY[2024].fat;
    const fat25 = YEAR_SUMMARY[2025].fat, fat26 = YEAR_SUMMARY[2026].fat;
    const g2324 = ((fat24-fat23)/fat23*100), g2425 = ((fat25-fat24)/fat24*100);
    const proj2026 = Math.round((fat26/3)*12);
    diags.push({ level:'warn', icon:'fa-chart-line',
      title:'2023 foi o ano recorde — dois anos seguidos de queda',
      msg:`<b>2023: R$210.591</b> foi o melhor faturamento da história AGE. Em 2024 caiu para R$162.440 (<b>${g2324.toFixed(1)}%</b>) e em 2025 para R$110.190 (<b>${g2425.toFixed(1)}%</b>). O Q1 de 2026 projeta ~R$${proj2026.toLocaleString('pt-BR')} no ano — recuperação em curso. Ações prioritárias: (1) reativar clientes de 2022–2023, (2) criar pipeline comercial com meta semanal, (3) formalizar contratos recorrentes com top 5 clientes.`
    });

    /* 2. JAY P concentração */
    const jayp = clientMap['JAY P'] || TOP_CLIENTS_HIST.find(c=>c.name==='JAY P') || { value: 243600, count: 27 };
    const jaypVal = jayp.value || 0;
    const jaypPct = totalRev>0 ? (jaypVal/totalRev*100) : 34.5;
    if (jaypPct > 20) {
      diags.push({ level:'critical', icon:'fa-exclamation-circle',
        title:`JAY P: ${jaypPct.toFixed(0)}% da receita histórica — risco de concentração`,
        msg:`<b>JAY P gerou R$${jaypVal.toLocaleString('pt-BR')}</b> em ${jayp.count||27} projetos entre 2022–2025 — <b>${jaypPct.toFixed(0)}%</b> de toda a receita histórica da AGE. É o maior ativo e o maior risco ao mesmo tempo. Se este cliente pausar, o impacto é imediato. Nenhum cliente deve superar 20–25% da receita anual. Ação: diversificar buscando 3 novos clientes com potencial de R$20k+/ano e formalizar contrato plurianual com JAY P.`
      });
    }

    /* 3. Crescimento 2021→2023 vs queda atual */
    const g2123 = ((YEAR_SUMMARY[2023].fat - YEAR_SUMMARY[2021].fat)/YEAR_SUMMARY[2021].fat*100);
    const t21 = YEAR_SUMMARY[2021].fat / YEAR_SUMMARY[2021].n;
    const t26 = YEAR_SUMMARY[2026].fat / YEAR_SUMMARY[2026].n;
    diags.push({ level:'ok', icon:'fa-seedling',
      title:`Capacidade comprovada: +${g2123.toFixed(0)}% em 2 anos (2021→2023)`,
      msg:`A AGE foi de <b>R$67.415 (2021)</b> para <b>R$210.591 (2023)</b> — <b>${g2123.toFixed(0)}%</b> de crescimento orgânico em apenas 2 anos. Isso não foi sorte — foi execução. A base de <b>${numClients} clientes</b> construída é um ativo poderoso. Uma campanha de reativação dos inativos tem potencial de gerar R$50–100k sem custo de aquisição. Você já sabe crescer — agora é refazer o caminho.`
    });

    /* 4. 2026 projeção detalhada */
    diags.push({ level: proj2026 > 150000 ? 'ok' : 'warn', icon:'fa-rocket',
      title:`2026 em andamento: R$${fat26.toLocaleString('pt-BR')} em Q1 → projeção ~R$${proj2026.toLocaleString('pt-BR')}`,
      msg:`Com <b>12 projetos e R$46.200 no Q1/2026</b>, a projeção linear é ~<b>R$${proj2026.toLocaleString('pt-BR')}</b> para o ano completo. ${proj2026 > YEAR_SUMMARY[2023].fat ? '🎯 Esse ritmo <b>supera o recorde de 2023</b>! Manter a consistência é o desafio.' : `Para superar 2023, faltam ~R$${Math.round(YEAR_SUMMARY[2023].fat-fat26).toLocaleString('pt-BR')} nos 9 meses restantes (meta: R$${Math.round((YEAR_SUMMARY[2023].fat-fat26)/9).toLocaleString('pt-BR')}/mês).`} Ticket médio 2026 em R$${Math.round(t26).toLocaleString('pt-BR')} vs R$${Math.round(t21).toLocaleString('pt-BR')} em 2021 — crescimento de ${((t26/t21-1)*100).toFixed(0)}%.`
    });

    /* 5. Custos ausentes em 2021/2025 */
    diags.push({ level:'warn', icon:'fa-file-invoice-dollar',
      title:'Custos não registrados em 2021 e 2025 — margem real desconhecida',
      msg:`As planilhas de <b>2021 (12 projetos)</b> e <b>2025 (23 projetos)</b> não têm custos preenchidos. Isso representa <b>35 projetos</b> (29% do total histórico) com margem desconhecida. Os R$177.605 faturados nesses anos podem ter margem real entre 30–80% dependendo dos custos reais. Recomendação urgente: reconstruir custos retroativamente para ter visão financeira precisa dos 5 anos.`
    });

    /* 6. NPS — análise por ano */
    const npsYears = [2023, 2024];
    const avgNps23 = YEAR_SUMMARY[2023].avgNps, avgNps24 = YEAR_SUMMARY[2024].avgNps;
    diags.push({ level:'ok', icon:'fa-star',
      title:`NPS excelente nos anos com dados: ${avgNps23.toFixed(1)}★ (2023) e ${avgNps24.toFixed(1)}★ (2024)`,
      msg:`Nos anos com NPS registrado, a AGE atingiu <b>9.0 em 2023</b> e <b>9.2 em 2024</b> — zona promotora (>9). Clientes nessa faixa indicam espontaneamente. O problema: <b>2021, 2022, 2025 e 2026 não têm NPS</b>. Crie um ritual pós-entrega simples — WhatsApp com "de 0 a 10, quanto nos indicaria?" + campo aberto. Em 30 dias você tem dados de todos os projetos ativos.`
    });

    /* 7. Margem operacional 2022 vs 2023/2024 */
    const mg22 = ((YEAR_SUMMARY[2022].lucro/YEAR_SUMMARY[2022].fat)*100);
    const mg23 = YEAR_SUMMARY[2023].margem, mg24 = YEAR_SUMMARY[2024].margem;
    diags.push({ level: mg22 < 50 ? 'warn' : 'ok', icon:'fa-percentage',
      title:`Evolução da margem: ${mg22.toFixed(0)}% (2022) → ${mg23.toFixed(0)}% (2023) → ${mg24.toFixed(0)}% (2024)`,
      msg:`Em 2022 com <b>25 projetos</b>, os custos foram <b>R$58.835 (54% do faturamento)</b> — margem de ${mg22.toFixed(0)}%. Em 2023 o custo caiu para <b>46% do fat.</b>, gerando margem de ${mg23.toFixed(0)}%. Em 2024 a margem foi ${mg24.toFixed(0)}%. A tendência de melhora na eficiência operacional é positiva. Continue reduzindo custos por projeto sem cortar qualidade.`
    });

    /* 8. Ticket médio crescente */
    if (t26 > t21) {
      diags.push({ level:'ok', icon:'fa-receipt',
        title:`Ticket médio ${((t26/t21-1)*100).toFixed(0)}% maior em 2026 vs 2021 — posicionamento premium funciona`,
        msg:`De <b>R$${Math.round(t21).toLocaleString('pt-BR')}/projeto (2021)</b> para <b>R$${Math.round(t26).toLocaleString('pt-BR')}/projeto (2026)</b>. Crescimento consistente do ticket prova que o posicionamento premium está funcionando. Continue: projetos abaixo de R$3.000 devem ser aceitos apenas se estratégicos (novo cliente importante, portfólio, indicação). Foco em projetos acima de R$5.000 aumenta a margem sem aumentar equipe.`
      });
    }

    /* 9. Oportunidade de reativação — base de 73 clientes */
    diags.push({ level:'ok', icon:'fa-sync',
      title:`${numClients} clientes na base histórica — maior ativo da AGE`,
      msg:`A AGE tem <b>${numClients} clientes únicos</b> de 2021 a 2026. Top 5: JAY P (R$243.600, 27 projetos), UNIVERSAL MUSIC (R$105.100, 5 projetos), Giana Mello (R$96.100, 12 projetos), LOU GARCIA (R$86.900, 4 projetos), KG NETWORK (R$69.550, 6 projetos). Muitos estão "inativos" mas já confiaram no trabalho. Uma abordagem direta — portfólio atualizado + nova proposta de serviço — tem potencial de gerar <b>R$50–100k sem custo de aquisição</b>.`
    });

    return diags;
  }

  function renderOverallLineChart(yearData) {
    destroyChart('histChartOverallLine');
    const canvas = document.getElementById('histChartOverallLine');
    if (!canvas) return;
    _charts['histChartOverallLine'] = new Chart(canvas.getContext('2d'), {
      type:'line',
      data:{
        labels: yearData.map(d=>d.year),
        datasets:[
          {label:'Faturamento',data:yearData.map(d=>d.rev),borderColor:'#00aaff',backgroundColor:'rgba(0,170,255,0.1)',borderWidth:2.5,pointBackgroundColor:'#00aaff',pointRadius:5,fill:true,tension:0.3},
          {label:'Lucro',      data:yearData.map(d=>d.pro),borderColor:'#00ff88',backgroundColor:'rgba(0,255,136,0.08)',borderWidth:2,  pointBackgroundColor:'#00ff88',pointRadius:4,fill:true,tension:0.3},
          {label:'Custo',      data:yearData.map(d=>d.cost),borderColor:'#ff4444',backgroundColor:'rgba(255,68,68,0.05)',borderWidth:1.5,pointBackgroundColor:'#ff4444',pointRadius:3,fill:true,tension:0.3,borderDash:[4,4]}
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{labels:{color:'rgba(180,200,220,.8)',font:{family:'Share Tech Mono',size:9}}},
          tooltip:{callbacks:{label:c=>' '+fmtBRL(c.raw)}}
        },
        scales:{
          x:{ticks:{color:'rgba(180,200,220,.7)',font:{family:'Orbitron',size:10}},grid:{color:'rgba(255,255,255,.04)'}},
          y:{ticks:{color:'rgba(180,200,220,.7)',font:{family:'Share Tech Mono',size:9},callback:v=>'R$'+Math.round(v/1000)+'k'},grid:{color:'rgba(255,255,255,.06)'}}
        }
      }
    });
  }

  function renderOverallCatChart(catMap) {
    destroyChart('histChartOverallCat');
    const canvas = document.getElementById('histChartOverallCat');
    if (!canvas) return;
    const entries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
    const colors  = ['#00aaff','#ff4466','#ffcc00','#00ff88','#cc44ff','#ff6600','#00f5ff','#ff99aa'];
    _charts['histChartOverallCat'] = new Chart(canvas.getContext('2d'), {
      type:'doughnut',
      data:{labels:entries.map(([k])=>k.toUpperCase()),datasets:[{data:entries.map(([,v])=>v),backgroundColor:colors,borderColor:'#0a0e1a',borderWidth:3}]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom',labels:{color:'rgba(180,200,220,.8)',font:{family:'Share Tech Mono',size:9},padding:8}},
          tooltip:{callbacks:{label:c=>' '+fmtBRL(c.raw)}}
        }
      }
    });
  }

  return { onNavigate, selectYear, showOverall };
})();
