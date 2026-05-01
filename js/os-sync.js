/* ============================================================
   AGE OPS — OS-SYNC.JS
   Motor central de sincronização entre todas as páginas.

   FLUXO DE DADOS:
   ┌─────────────────────────────────────────────────────────┐
   │  age_projects (projetos ativos)                         │
   │    ↓ ao salvar/editar/deletar projeto                   │
   │    → Dashboard recarrega KPIs e gráficos                │
   │    → Kanban (age_project_stages) sincroniza card        │
   │    → Fechamento atualiza select de projetos             │
   │    → Calendário da Equipe atualiza eventos vinculados   │
   │                                                         │
   │  age_fechamento + age_gastos (fechamento financeiro)    │
   │    ↓ ao salvar gasto ou cabeçalho do fechamento         │
   │    → age_projects.cost e .profit_pct são atualizados    │
   │    → Dashboard recarrega KPIs (margem, lucro real)      │
   │    → age_hist_projects sincroniza se projeto concluído  │
   │    → age_clients_db atualiza total_value e avg_nps      │
   │                                                         │
   │  age_project_stages (kanban)                            │
   │    ↓ ao avançar etapa / mudar status                    │
   │    → age_projects.status é atualizado                   │
   │    → Dashboard recarrega                                │
   │    → Se etapa = "Postado" → projeto marcado concluido   │
   │                                                         │
   │  age_hist_projects (histórico)                          │
   │    ↓ leitura somente — alimentado pelo Fechamento       │
   │    → Histórico e Clientes sempre buscam dados frescos   │
   └─────────────────────────────────────────────────────────┘
   ============================================================ */

window.SYNC = (() => {
  'use strict';

  /* ────────────────────────────────────────────────────────
     MAPA DE ETAPAS KANBAN → STATUS DO PROJETO
  ──────────────────────────────────────────────────────── */
  const STAGE_TO_STATUS = {
    'reuniao':          'pendente',
    'pre_producao':     'em_andamento',
    'orcamento':        'em_andamento',
    'gravacao':         'em_andamento',
    'edicao':           'em_andamento',
    'finalizacao':      'em_andamento',
    'entrega_aprovada': 'em_andamento',
    'postado':          'concluido'
  };

  /* ────────────────────────────────────────────────────────
     EVENTO BUS — notificar páginas ativas sobre mudanças
  ──────────────────────────────────────────────────────── */
  const _listeners = {};

  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  }

  function emit(event, data) {
    (_listeners[event] || []).forEach(fn => { try { fn(data); } catch(e) {} });
  }

  /* ────────────────────────────────────────────────────────
     HELPERS
  ──────────────────────────────────────────────────────── */
  async function patchProject(pid, fields) {
    try {
      const r = await fetch(`tables/age_projects/${pid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      return r.ok ? await r.json() : null;
    } catch(e) { return null; }
  }

  async function fetchProject(pid) {
    try {
      const r = await fetch(`tables/age_projects/${pid}`);
      return r.ok ? await r.json() : null;
    } catch(e) { return null; }
  }

  async function sumGastos(fechId, projId) {
    try {
      const r = await fetch('tables/age_gastos?limit=500');
      const d = r.ok ? await r.json() : { data: [] };
      return (d.data || [])
        .filter(g => !g.deleted && (g.fechamento_id === fechId || g.project_id === projId))
        .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
    } catch(e) { return 0; }
  }

  /* ────────────────────────────────────────────────────────
     SINCRONIZAÇÃO APÓS FECHAMENTO SALVO OU GASTO ALTERADO
     → Propaga custo real para age_projects
     → Atualiza profit_pct
     → Se concluído, sincroniza age_hist_projects
     → Recarrega dashboard
  ──────────────────────────────────────────────────────── */
  async function onFechamentoSaved(fechData, gastosSomados) {
    if (!fechData || !fechData.project_id) return;

    const pid        = fechData.project_id;
    const totalValue = parseFloat(fechData.total_value) || 0;
    const imposto    = parseFloat(fechData.imposto_valor) || 0;
    const gastos     = gastosSomados !== undefined
      ? gastosSomados
      : await sumGastos(fechData.id, pid);

    const cost       = gastos + imposto;   // custo total = gastos + imposto
    const profit     = totalValue - cost;
    const profitPct  = totalValue > 0 ? (profit / totalValue * 100) : 0;

    // 1. Atualizar age_projects com custo real e margem real
    await patchProject(pid, {
      cost:       Math.round(cost * 100) / 100,
      profit_pct: parseFloat(profitPct.toFixed(2)),
      total_value: totalValue
    });

    // 2. Emitir evento para que páginas ativas recarreguem
    emit('project:updated', { pid, cost, profit, profitPct, totalValue });
    emit('fechamento:saved', { fechData, gastos, cost, profit, profitPct });

    // 3. Se o projeto está concluído, sincronizar com histórico
    const proj = await fetchProject(pid);
    if (proj && proj.status === 'concluido') {
      await syncHistoricoEntry(proj, cost, profit, profitPct);
    }

    // 4. Atualizar cliente no banco de clientes
    if (proj) {
      await syncClienteDB(proj.client_name || '');
    }

    // 5. Recarregar dashboard se estiver ativo
    _reloadIfActive('dashboard', () => { if (typeof loadDashboard === 'function') loadDashboard(); });
    _reloadIfActive('projects',  () => { if (typeof loadProjects  === 'function') loadProjects(); });
  }

  /* ────────────────────────────────────────────────────────
     SINCRONIZAÇÃO APÓS PROJETO SALVO/EDITADO
     → Recarrega Dashboard, Kanban, Fechamento
  ──────────────────────────────────────────────────────── */
  async function onProjectSaved(proj) {
    if (!proj) return;
    emit('project:saved', proj);

    // Atualizar card no Kanban se existir
    await syncKanbanCard(proj);

    // Se status = concluido, sincronizar histórico
    if (proj.status === 'concluido') {
      // Buscar fechamento para pegar custos reais
      const fech = await getFechByProject(proj.id);
      const gastos = fech ? await sumGastos(fech.id, proj.id) : 0;
      const imposto = fech ? (parseFloat(fech.imposto_valor) || 0) : 0;
      const cost = gastos + imposto;
      const val = parseFloat(proj.total_value) || 0;
      const profit = val - cost;
      const profitPct = val > 0 ? (profit / val * 100) : 0;

      // Patch project com custos finais
      await patchProject(proj.id, {
        cost: Math.round(cost * 100) / 100,
        profit_pct: parseFloat(profitPct.toFixed(2))
      });

      await syncHistoricoEntry(proj, cost, profit, profitPct);
      await syncClienteDB(proj.client_name || '');
    }

    _reloadIfActive('dashboard', () => { if (typeof loadDashboard === 'function') loadDashboard(); });
    _reloadIfActive('fechamento', () => { if (typeof loadFechamentoList === 'function') loadFechamentoList(); });
    if (window.GESTAO) _reloadIfActive('gestao', () => window.GESTAO.onNavigate());
  }

  /* ────────────────────────────────────────────────────────
     SINCRONIZAÇÃO APÓS ETAPA DO KANBAN MUDAR
     → Propaga status para age_projects
     → Se "Postado" → marca concluído
  ──────────────────────────────────────────────────────── */
  async function onKanbanStageChanged(stageCard) {
    if (!stageCard || !stageCard.project_id) return;

    const pid    = stageCard.project_id;
    const stage  = stageCard.stage || '';
    const status = STAGE_TO_STATUS[stage] || 'em_andamento';

    emit('kanban:stage_changed', { pid, stage, status });

    await patchProject(pid, { status });

    if (status === 'concluido') {
      const proj = await fetchProject(pid);
      if (proj) await onProjectSaved({ ...proj, status: 'concluido' });
    }

    _reloadIfActive('dashboard', () => { if (typeof loadDashboard === 'function') loadDashboard(); });
    _reloadIfActive('projects',  () => { if (typeof loadProjects  === 'function') loadProjects(); });
  }

  /* ────────────────────────────────────────────────────────
     SINCRONIZAR CARD DO KANBAN QUANDO PROJETO MUDA
  ──────────────────────────────────────────────────────── */
  async function syncKanbanCard(proj) {
    if (!proj?.id) return;
    try {
      const r = await fetch('tables/age_project_stages?limit=200');
      const d = r.ok ? await r.json() : { data: [] };
      const cards = (d.data || []).filter(c => !c.deleted && c.project_id === proj.id);
      for (const card of cards) {
        await fetch(`tables/age_project_stages/${card.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:    proj.project_name || card.title,
            client:   proj.client_name  || card.client,
            value:    proj.total_value  || card.value,
            category: proj.category     || card.category
          })
        });
      }
    } catch(e) {}
  }

  /* ────────────────────────────────────────────────────────
     SINCRONIZAR HISTÓRICO (age_hist_projects)
     Quando um projeto é concluído com fechamento salvo
  ──────────────────────────────────────────────────────── */
  async function syncHistoricoEntry(proj, cost, profit, profitPct) {
    if (!proj?.id) return;

    // Verificar se já existe entrada para este projeto (por project_id armazenado como project_name match + year)
    // Buscar por client_name + project_name + ano (já que hist não tem project_id direto)
    const payDate = proj.payment_date || proj.project_date || '';
    const year    = payDate ? new Date(payDate + 'T00:00:00').getFullYear() : new Date().getFullYear();
    const month   = payDate ? new Date(payDate + 'T00:00:00').getMonth() + 1 : 0;

    const nps   = parseFloat(proj.nps) || 0;
    const val   = parseFloat(proj.total_value) || 0;
    const isNew = proj.is_new_client === true || proj.is_new_client === 'true';

    const histPayload = {
      year,
      client_name:   proj.client_name   || '?',
      project_name:  proj.project_name  || '?',
      sale_date:     proj.project_date  || '',
      payment_date:  proj.payment_date  || '',
      month,
      is_new_client: isNew,
      value:         Math.round(val * 100) / 100,
      cost:          Math.round(cost * 100) / 100,
      profit:        Math.round(profit * 100) / 100,
      margin_pct:    parseFloat(profitPct.toFixed(2)),
      nps:           (nps > 10 || nps < 0) ? 0 : nps,
      category:      proj.category || 'producao',
      segment:       '',
      status:        'concluido'
    };

    // Procurar entrada existente para este projeto (pelo ID do projeto no campo notes ou por match exato)
    try {
      const r = await fetch(`tables/age_hist_projects?limit=500`);
      const d = r.ok ? await r.json() : { data: [] };
      const existing = (d.data || []).find(h =>
        !h.deleted &&
        h.year == year &&
        (h.client_name || '').toLowerCase() === (proj.client_name || '').toLowerCase() &&
        (h.project_name || '').toLowerCase() === (proj.project_name || '').toLowerCase()
      );

      if (existing) {
        // Atualizar entrada existente
        await fetch(`tables/age_hist_projects/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            value:      histPayload.value,
            cost:       histPayload.cost,
            profit:     histPayload.profit,
            margin_pct: histPayload.margin_pct,
            nps:        histPayload.nps,
            status:     'concluido'
          })
        });
        emit('historico:updated', { id: existing.id, ...histPayload });
      } else {
        // Criar nova entrada apenas se o projeto pertencer aos anos das planilhas ou for novo
        // Só criar entrada automática se o projeto NÃO for dos anos 2021-2026 já importados
        // (para não duplicar). Se for 2027+, criar sempre.
        if (year >= 2027 || !_isFromImportedYears(year)) {
          await fetch('tables/age_hist_projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(histPayload)
          });
          emit('historico:created', histPayload);
        } else {
          // Anos 2021-2026: procurar por nome similar para atualizar
          // (pode ser um projeto novo desses anos não importado)
          await fetch('tables/age_hist_projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(histPayload)
          });
          emit('historico:created', histPayload);
        }
      }
    } catch(e) {}
  }

  function _isFromImportedYears(year) {
    return year >= 2021 && year <= 2026;
  }

  /* ────────────────────────────────────────────────────────
     SINCRONIZAR BANCO DE CLIENTES (age_clients_db)
  ──────────────────────────────────────────────────────── */
  async function syncClienteDB(clientName) {
    if (!clientName) return;
    try {
      // Buscar todos os projetos históricos deste cliente
      const r = await fetch('tables/age_hist_projects?limit=500');
      const d = r.ok ? await r.json() : { data: [] };
      const projs = (d.data || []).filter(p =>
        !p.deleted &&
        (p.client_name || '').toLowerCase() === clientName.toLowerCase()
      );

      if (!projs.length) return;

      const totalValue = projs.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
      const withNps    = projs.filter(p => parseFloat(p.nps) > 0);
      const avgNps     = withNps.length
        ? withNps.reduce((s, p) => s + (parseFloat(p.nps) || 0), 0) / withNps.length
        : 0;
      const years      = [...new Set(projs.map(p => p.year))].sort();
      const firstYear  = Math.min(...years);
      const lastYear   = Math.max(...years);

      // Calcular status baseado no último ano
      let status = 'inativo';
      const curYear = new Date().getFullYear();
      if (lastYear >= curYear) status = 'ativo';
      else if (lastYear >= curYear - 1) status = 'recorrente';

      const payload = {
        total_value:    Math.round(totalValue * 100) / 100,
        total_projects: projs.length,
        avg_nps:        parseFloat(avgNps.toFixed(1)),
        first_year:     firstYear,
        last_year:      lastYear,
        years_active:   years.join(','),
        status
      };

      // Buscar cliente existente
      const rc = await fetch('tables/age_clients_db?limit=200');
      const dc = rc.ok ? await rc.json() : { data: [] };
      const existing = (dc.data || []).find(c =>
        !c.deleted &&
        (c.client_name || '').toLowerCase() === clientName.toLowerCase()
      );

      if (existing) {
        await fetch(`tables/age_clients_db/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('tables/age_clients_db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_name: clientName, ...payload, notes: '' })
        });
      }

      emit('clientes:updated', { clientName, ...payload });
      // Recarregar página de clientes se ativa
      _reloadIfActive('clientes', () => { if (window.CLIENTS) window.CLIENTS.onNavigate(); });
    } catch(e) {}
  }

  /* ────────────────────────────────────────────────────────
     BUSCAR FECHAMENTO POR PROJETO
  ──────────────────────────────────────────────────────── */
  async function getFechByProject(pid) {
    try {
      const r = await fetch(`tables/age_fechamento?limit=10&search=${encodeURIComponent(pid)}`);
      const d = r.ok ? await r.json() : { data: [] };
      return (d.data || []).find(f => f.project_id === pid && !f.deleted) || null;
    } catch(e) { return null; }
  }

  /* ────────────────────────────────────────────────────────
     HELPER: recarregar página apenas se estiver ativa
  ──────────────────────────────────────────────────────── */
  function _reloadIfActive(pageId, fn) {
    const el = document.getElementById(`page-${pageId}`);
    if (el && el.classList.contains('active')) {
      setTimeout(fn, 100);
    }
  }

  /* ────────────────────────────────────────────────────────
     SINCRONIZAÇÃO COMPLETA DO DASHBOARD
     Inclui dados de fechamentos reais
  ──────────────────────────────────────────────────────── */
  async function getDashboardData() {
    // Buscar projetos
    const rp = await fetch('tables/age_projects?limit=300');
    const dp = rp.ok ? await rp.json() : { data: [] };
    const projects = (dp.data || []).filter(p => !p.deleted);

    // Buscar fechamentos para enriquecer com custos reais
    const rf = await fetch('tables/age_fechamento?limit=300');
    const df = rf.ok ? await rf.json() : { data: [] };
    const fechamentos = (df.data || []).filter(f => !f.deleted);

    // Buscar gastos
    const rg = await fetch('tables/age_gastos?limit=1000');
    const dg = rg.ok ? await rg.json() : { data: [] };
    const gastos = (dg.data || []).filter(g => !g.deleted);

    // Enriquecer projetos com custo real do fechamento
    const enriched = projects.map(p => {
      const fech = fechamentos.find(f => f.project_id === p.id);
      if (fech) {
        const gastosProj = gastos
          .filter(g => g.fechamento_id === fech.id || g.project_id === p.id)
          .reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
        const imposto = parseFloat(fech.imposto_valor) || 0;
        const cost    = gastosProj + imposto;
        const val     = parseFloat(fech.total_value) || parseFloat(p.total_value) || 0;
        const profit  = val - cost;
        const pct     = val > 0 ? (profit / val * 100) : 0;
        return { ...p, cost, total_value: val, _profit: profit, _profitPct: pct, _hasFech: true };
      }
      return { ...p, _hasFech: false };
    });

    return { projects: enriched, fechamentos, gastos };
  }

  /* ────────────────────────────────────────────────────────
     RECARREGAR TODAS AS PÁGINAS ATIVAS
  ──────────────────────────────────────────────────────── */
  function reloadAll() {
    _reloadIfActive('dashboard',     () => { if (typeof loadDashboard  === 'function') loadDashboard(); });
    _reloadIfActive('projects',      () => { if (typeof loadProjects   === 'function') loadProjects(); });
    _reloadIfActive('historico',     () => { if (window.HIST)    window.HIST.onNavigate(); });
    _reloadIfActive('clientes',      () => { if (window.CLIENTS) window.CLIENTS.onNavigate(); });
    _reloadIfActive('gestao',        () => { if (window.GESTAO)  window.GESTAO.onNavigate(); });
    _reloadIfActive('fechamento',    () => { if (typeof loadFechamentoList === 'function') loadFechamentoList(); });
  }

  /* ────────────────────────────────────────────────────────
     LISTENER BIDIRECIONAL: Dashboard ↔ Projetos
     Qualquer evento que altere dados financeiros propaga
     para AMBAS as páginas simultaneamente.
  ──────────────────────────────────────────────────────── */
  function _setupBidirectionalSync() {
    /* Quando fechamento é salvo → projetos recalculam KPIs */
    on('fechamento:saved', () => {
      _reloadIfActive('projects', () => {
        if (typeof loadProjects === 'function') loadProjects();
      });
    });

    /* Quando projeto é atualizado → projetos e dashboard sincronizam */
    on('project:updated', () => {
      _reloadIfActive('projects', () => {
        if (typeof loadProjects === 'function') loadProjects();
      });
      _reloadIfActive('dashboard', () => {
        if (typeof loadDashboard === 'function') loadDashboard();
      });
    });

    /* Quando kanban muda etapa → projetos refletem novo status */
    on('kanban:stage_changed', () => {
      _reloadIfActive('projects', () => {
        if (typeof loadProjects === 'function') loadProjects();
      });
    });

    /* Quando histórico é atualizado → projetos atualizam painel 2026 */
    on('historico:updated', () => {
      _reloadIfActive('projects', () => {
        if (typeof loadProjects === 'function') loadProjects();
      });
    });
  }

  /* Inicializar listeners ao carregar o SYNC */
  /* Usar setTimeout para garantir que loadProjects/loadDashboard já existam */
  setTimeout(_setupBidirectionalSync, 500);

  /* ────────────────────────────────────────────────────────
     API PÚBLICA
  ──────────────────────────────────────────────────────── */
  return {
    on,
    emit,
    onFechamentoSaved,
    onProjectSaved,
    onKanbanStageChanged,
    syncHistoricoEntry,
    syncClienteDB,
    syncKanbanCard,
    getDashboardData,
    sumGastos,
    getFechByProject,
    reloadAll
  };
})();
