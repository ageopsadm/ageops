/* ============================================================
   AGE OPS — OS-CLIENTES.JS
   Banco de dados de clientes histórico
   ============================================================ */

window.CLIENTS = (() => {
  'use strict';

  let _clients = [];
  let _projects = [];
  let _filterStatus = 'all';
  let _search = '';
  let _editId = null;

  function fmtBRL(v) {
    return (parseFloat(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
  }

  /* ════════════════════════════════════════════════════════
     INICIALIZAÇÃO
  ════════════════════════════════════════════════════════ */
  async function onNavigate() {
    await Promise.all([loadClients(), loadProjects()]);
    syncClientsFromHistory(); // sincroniza KPIs automaticamente do histórico
    renderStats();
    renderClients();
  }

  /* Sincronizar métricas dos clientes a partir do histórico importado
     FONTE PRIMÁRIA: age_hist_projects sempre sobrepõe age_clients_db
     para garantir contagem e valores corretos */
  function syncClientsFromHistory() {
    if (!_projects.length) return;

    // Construir mapa de projetos por cliente (nome normalizado)
    const projMap = {};
    _projects.forEach(p => {
      const key = (p.client_name||'').toLowerCase().trim();
      if (!projMap[key]) projMap[key] = [];
      projMap[key].push(p);
    });

    // Para cada cliente cadastrado, SEMPRE recalcular do histórico
    _clients.forEach(c => {
      const key    = (c.client_name||'').toLowerCase().trim();
      const cProjs = projMap[key] || [];
      if (!cProjs.length) return;

      const totVal  = cProjs.reduce((s,p)=>s+(parseFloat(p.value)||0), 0);
      const withNps = cProjs.filter(p=>parseFloat(p.nps)>0);
      const avgNps  = withNps.length
        ? withNps.reduce((s,p)=>s+(parseFloat(p.nps)||0),0)/withNps.length : 0;
      const years   = [...new Set(cProjs.map(p=>p.year))].sort();
      const firstY  = years[0];
      const lastY   = years[years.length-1];

      // Cachear no objeto local
      c._hist_value   = totVal;
      c._hist_count   = cProjs.length;
      c._hist_nps     = avgNps;
      c._hist_years   = years;
      c._hist_firstY  = firstY;
      c._hist_lastY   = lastY;

      // SEMPRE sobrepor com dados do histórico (fonte verdade)
      c.total_value    = totVal;
      c.total_projects = cProjs.length;
      if (avgNps > 0) c.avg_nps = parseFloat(avgNps.toFixed(1));
      if (firstY)     c.first_year = firstY;
      if (lastY)      c.last_year  = lastY;
      if (years.length) c.years_active = years.join(',');
    });

    // Adicionar clientes que estão no histórico mas não em age_clients_db
    const existingNames = new Set(_clients.map(c=>(c.client_name||'').toLowerCase().trim()));
    Object.entries(projMap).forEach(([key, projs]) => {
      if (existingNames.has(key)) return;
      const name   = projs[0].client_name || key;
      const totVal = projs.reduce((s,p)=>s+(parseFloat(p.value)||0),0);
      const withNps= projs.filter(p=>parseFloat(p.nps)>0);
      const avgNps = withNps.length ? withNps.reduce((s,p)=>s+(parseFloat(p.nps)||0),0)/withNps.length : 0;
      const years  = [...new Set(projs.map(p=>p.year))].sort();
      const curYear= new Date().getFullYear();
      const lastY  = years[years.length-1];
      const status = lastY >= curYear ? 'ativo' : lastY >= curYear-1 ? 'recorrente' : 'inativo';
      _clients.push({
        id: 'hist_' + key.replace(/\s+/g,'_'),
        client_name:    name,
        first_year:     years[0],
        last_year:      lastY,
        total_projects: projs.length,
        total_value:    totVal,
        avg_nps:        parseFloat(avgNps.toFixed(1)),
        status,
        notes:          '',
        years_active:   years.join(','),
        _hist_count:    projs.length,
        _hist_value:    totVal,
        _hist_years:    years,
        _fromHistory:   true
      });
    });

    // Re-ordenar por faturamento
    _clients.sort((a,b)=>(parseFloat(b.total_value)||0)-(parseFloat(a.total_value)||0));
  }

  async function loadClients() {
    try {
      const res = await fetch('tables/age_clients_db?limit=200&sort=total_value');
      const data = res.ok ? await res.json() : { data: [] };
      _clients = (data.data||[]).filter(c => !c.deleted)
        .sort((a,b) => (parseFloat(b.total_value)||0)-(parseFloat(a.total_value)||0));
    } catch(e) { _clients = []; }
  }

  async function loadProjects() {
    try {
      const res = await fetch('tables/age_hist_projects?limit=500');
      const data = res.ok ? await res.json() : { data: [] };
      _projects = (data.data||[]).filter(p => !p.deleted);
    } catch(e) { _projects = []; }
  }

  /* ════════════════════════════════════════════════════════
     STATS GERAIS
  ════════════════════════════════════════════════════════ */
  function renderStats() {
    const total       = _clients.length;
    const ativos      = _clients.filter(c => c.status === 'ativo').length;
    const recorrentes = _clients.filter(c => c.status === 'recorrente').length;
    const inativos    = _clients.filter(c => c.status === 'inativo').length;

    /* Usar total_value sincronizado do histórico */
    const totalVal = _clients.reduce((s,c) => s+(parseFloat(c.total_value)||parseFloat(c._hist_value)||0), 0);

    /* Métricas dos projetos históricos — fonte primária */
    const totalProjects = _projects.length || 122;
    const withNps  = _projects.filter(p => parseFloat(p.nps) > 0);
    const avgNps   = withNps.length ? withNps.reduce((s,p)=>s+(parseFloat(p.nps)||0),0)/withNps.length : 0;

    /* Clientes com mais de 1 projeto histórico */
    const cliProjCount = {};
    _projects.forEach(p => {
      const c = (p.client_name||'').toLowerCase().trim();
      cliProjCount[c] = (cliProjCount[c]||0)+1;
    });
    const multiProjClients = Object.values(cliProjCount).filter(n=>n>1).length;

    setEl('cliStatTotal',    total);
    setEl('cliStatAtivos',   ativos + recorrentes);
    setEl('cliStatInativos', inativos);
    setEl('cliStatValor',    fmtBRL(totalVal));
    setEl('cliStatProjects', totalProjects);
    setEl('cliStatNps',      avgNps > 0 ? avgNps.toFixed(1) + '★' : '—');
    setEl('cliStatMulti',    multiProjClients);
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ════════════════════════════════════════════════════════
     FILTROS
  ════════════════════════════════════════════════════════ */
  function filterStatus(status) {
    _filterStatus = status;
    document.querySelectorAll('.cli-filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-clistatus="${status}"]`);
    if (btn) btn.classList.add('active');
    renderClients();
  }

  function searchClients(val) {
    _search = (val||'').toLowerCase().trim();
    renderClients();
  }

  /* ════════════════════════════════════════════════════════
     RENDERIZAR LISTA
  ════════════════════════════════════════════════════════ */
  function renderClients() {
    const container = document.getElementById('cliGrid');
    if (!container) return;

    let filtered = _clients;
    if (_filterStatus !== 'all') filtered = filtered.filter(c => c.status === _filterStatus);
    if (_search) filtered = filtered.filter(c =>
      (c.client_name||'').toLowerCase().includes(_search) ||
      (c.notes||'').toLowerCase().includes(_search) ||
      (c.years_active||'').includes(_search)
    );

    if (filtered.length === 0) {
      container.innerHTML = `<div class="cli-empty"><i class="fas fa-users"></i><div>Nenhum cliente encontrado</div></div>`;
      return;
    }

    const statusConfig = {
      ativo:      { label: 'ATIVO',      color: '#00ff88', icon: 'fa-check-circle' },
      recorrente: { label: 'RECORRENTE', color: '#00aaff', icon: 'fa-sync' },
      inativo:    { label: 'INATIVO',    color: '#888',    icon: 'fa-pause-circle' },
      potencial:  { label: 'POTENCIAL',  color: '#ffcc00', icon: 'fa-star' }
    };

    container.innerHTML = filtered.map(c => {
      const cfg = statusConfig[c.status] || statusConfig.inativo;
      const years = (c.years_active||'').split(',').filter(Boolean);
      const avgNps = parseFloat(c.avg_nps)||0;

      // Projetos desse cliente na tabela histórica
      const cProjs = _projects.filter(p => (p.client_name||'').toLowerCase() === (c.client_name||'').toLowerCase());
      const allYears = [...new Set(cProjs.map(p=>p.year))].sort();

      // Iniciais para avatar
      const initials = (c.client_name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      const colors = ['#ff1a1a','#00aaff','#ffcc00','#00ff88','#cc44ff','#ff6600','#ff44aa','#44ffcc'];
      const colorIdx = c.client_name.charCodeAt(0) % colors.length;

      // Usar contagem do histórico como fonte primária
      const projCount  = c._hist_count  || parseInt(c.total_projects) || cProjs.length || 0;
      const totalValue = c._hist_value  || parseFloat(c.total_value)  || 0;
      const npsDisplay = parseFloat(c.avg_nps) || parseFloat(c._hist_nps) || 0;

      return `
        <div class="cli-card" data-id="${c.id}">
          <div class="cli-card-header">
            <div class="cli-avatar" style="background:${colors[colorIdx]}22;color:${colors[colorIdx]};border-color:${colors[colorIdx]}66">
              ${initials}
            </div>
            <div class="cli-info">
              <div class="cli-name">${c.client_name}</div>
              <div class="cli-years">${allYears.length > 0 ? allYears.join(' · ') : (c.years_active||'—')}</div>
            </div>
            <div class="cli-status-badge" style="color:${cfg.color};border-color:${cfg.color}44;background:${cfg.color}11">
              <i class="fas ${cfg.icon}"></i> ${cfg.label}
            </div>
          </div>

          <div class="cli-metrics">
            <div class="cli-metric">
              <div class="cli-metric-label">FATURAMENTO</div>
              <div class="cli-metric-value">${fmtBRL(totalValue)}</div>
            </div>
            <div class="cli-metric">
              <div class="cli-metric-label">PROJETOS</div>
              <div class="cli-metric-value">${projCount}</div>
            </div>
            <div class="cli-metric">
              <div class="cli-metric-label">NPS</div>
              <div class="cli-metric-value">${npsDisplay > 0 ? npsDisplay.toFixed(1)+'★' : '—'}</div>
            </div>
            <div class="cli-metric">
              <div class="cli-metric-label">DESDE</div>
              <div class="cli-metric-value">${c.first_year||'—'}</div>
            </div>
          </div>

          ${c.notes ? `<div class="cli-notes"><i class="fas fa-sticky-note"></i> ${c.notes}</div>` : ''}

          <div class="cli-actions">
            <button class="btn-ghost" style="font-size:11px;padding:6px 12px" onclick="CLIENTS.openEdit('${c.id}')">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn-ghost" style="font-size:11px;padding:6px 12px" onclick="CLIENTS.viewHistory('${c.client_name}')">
              <i class="fas fa-history"></i> Histórico
            </button>
            <select class="hud-select" style="font-size:10px;padding:4px 8px;height:auto" onchange="CLIENTS.changeStatus('${c.id}', this.value)">
              <option value="ativo" ${c.status==='ativo'?'selected':''}>Ativo</option>
              <option value="recorrente" ${c.status==='recorrente'?'selected':''}>Recorrente</option>
              <option value="inativo" ${c.status==='inativo'?'selected':''}>Inativo</option>
              <option value="potencial" ${c.status==='potencial'?'selected':''}>Potencial</option>
            </select>
          </div>
        </div>`;
    }).join('');
  }

  /* ════════════════════════════════════════════════════════
     HISTÓRICO DO CLIENTE
  ════════════════════════════════════════════════════════ */
  function viewHistory(clientName) {
    const cProjs = _projects
      .filter(p => (p.client_name||'').toLowerCase() === clientName.toLowerCase())
      .sort((a,b) => (a.year||0)-(b.year||0) || (a.month||0)-(b.month||0));

    if (cProjs.length === 0) {
      showToast('Nenhum projeto encontrado para ' + clientName);
      return;
    }

    const totalVal = cProjs.reduce((s,p) => s+(parseFloat(p.value)||0), 0);
    const totalPro = cProjs.reduce((s,p) => s+(parseFloat(p.profit)||0), 0);
    const margin   = totalVal > 0 ? (totalPro/totalVal*100) : 0;

    const modal = document.getElementById('modalCliHistory');
    const body  = document.getElementById('cliHistoryBody');
    if (!modal || !body) return;

    document.getElementById('cliHistoryTitle').textContent = clientName.toUpperCase();

    const monthNames = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const statusMap = { concluido:'badge-concluido', em_andamento:'badge-em_andamento', pendente:'badge-pendente' };
    const statusLbl = { concluido:'Concluído', em_andamento:'Em Andamento', pendente:'Pendente' };

    body.innerHTML = `
      <div class="cli-hist-summary">
        <div class="cli-hist-stat"><span>${cProjs.length}</span><small>Projetos</small></div>
        <div class="cli-hist-stat"><span>${fmtBRL(totalVal)}</span><small>Faturamento Total</small></div>
        <div class="cli-hist-stat"><span>${fmtBRL(totalPro)}</span><small>Lucro Gerado</small></div>
        <div class="cli-hist-stat"><span>${margin.toFixed(1)}%</span><small>Margem Média</small></div>
      </div>
      <div class="table-wrap" style="margin-top:16px">
        <table class="hud-table">
          <thead><tr><th>ANO</th><th>MÊS</th><th>PROJETO</th><th>VALOR</th><th>MARGEM</th><th>NPS</th><th>STATUS</th></tr></thead>
          <tbody>
            ${cProjs.map(p => `
              <tr>
                <td><b style="color:#00aaff">${p.year}</b></td>
                <td>${monthNames[p.month]||p.month||'—'}</td>
                <td>${p.project_name||'—'}</td>
                <td><b>${fmtBRL(p.value)}</b></td>
                <td style="color:${parseFloat(p.margin_pct)>=50?'#00ff88':'#ffcc00'}">${parseFloat(p.margin_pct).toFixed(1)}%</td>
                <td>${parseFloat(p.nps)>0?parseFloat(p.nps).toFixed(1)+'★':'—'}</td>
                <td><span class="badge ${statusMap[p.status]||''}">${statusLbl[p.status]||p.status||'—'}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    modal.classList.add('open');
  }

  /* ════════════════════════════════════════════════════════
     EDITAR CLIENTE
  ════════════════════════════════════════════════════════ */
  function openEdit(id) {
    const c = _clients.find(x => x.id === id);
    if (!c) return;
    _editId = id;

    document.getElementById('cliEditName').value = c.client_name || '';
    document.getElementById('cliEditStatus').value = c.status || 'inativo';
    document.getElementById('cliEditNotes').value = c.notes || '';
    document.getElementById('cliEditNps').value = c.avg_nps || '';

    document.getElementById('modalCliEdit').classList.add('open');
  }

  async function saveEdit() {
    if (!_editId) return;
    const payload = {
      client_name: document.getElementById('cliEditName').value.trim(),
      status: document.getElementById('cliEditStatus').value,
      notes: document.getElementById('cliEditNotes').value.trim(),
      avg_nps: parseFloat(document.getElementById('cliEditNps').value) || 0
    };
    try {
      await fetch(`tables/age_clients_db/${_editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      closeEditModal();
      await loadClients();
      renderStats();
      renderClients();
      showToast('Cliente atualizado!');
    } catch(e) { showToast('Erro ao salvar'); }
  }

  function closeEditModal() {
    document.getElementById('modalCliEdit').classList.remove('open');
    _editId = null;
  }

  async function changeStatus(id, status) {
    try {
      await fetch(`tables/age_clients_db/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const c = _clients.find(x => x.id === id);
      if (c) c.status = status;
      renderStats();
      renderClients();
      showToast('Status atualizado: ' + status.toUpperCase());
    } catch(e) { showToast('Erro ao atualizar status'); }
  }

  /* ════════════════════════════════════════════════════════
     ADICIONAR NOVO CLIENTE
  ════════════════════════════════════════════════════════ */
  function openAdd() {
    _editId = null;
    document.getElementById('cliEditName').value = '';
    document.getElementById('cliEditStatus').value = 'inativo';
    document.getElementById('cliEditNotes').value = '';
    document.getElementById('cliEditNps').value = '';
    document.getElementById('modalCliEdit').classList.add('open');
  }

  async function saveNew() {
    const name = document.getElementById('cliEditName').value.trim();
    if (!name) { showToast('Informe o nome do cliente'); return; }
    const payload = {
      client_name: name,
      status: document.getElementById('cliEditStatus').value,
      notes: document.getElementById('cliEditNotes').value.trim(),
      avg_nps: parseFloat(document.getElementById('cliEditNps').value) || 0,
      total_projects: 0, total_value: 0, first_year: new Date().getFullYear(), last_year: new Date().getFullYear(), years_active: ''
    };
    try {
      await fetch('tables/age_clients_db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      closeEditModal();
      await loadClients();
      renderStats();
      renderClients();
      showToast('Cliente adicionado!');
    } catch(e) { showToast('Erro ao adicionar'); }
  }

  function handleSave() {
    if (_editId) saveEdit(); else saveNew();
  }

  function showToast(msg) {
    if (window.showToast) window.showToast(msg);
    else {
      const t = document.getElementById('toast');
      const tx = document.getElementById('toastText');
      if (t && tx) { tx.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }
    }
  }

  return { onNavigate, filterStatus, searchClients, viewHistory, openEdit, saveEdit, closeEditModal, changeStatus, openAdd, handleSave };
})();
