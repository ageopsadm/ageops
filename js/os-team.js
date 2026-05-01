/* ============================================================
   AGE OPS — OS-TEAM.JS
   Módulo: Colaboradores + Calendário da Equipe
   ============================================================ */

/* ══════════════════════════════════════════════════════════
   TEAM — COLABORADORES
   ══════════════════════════════════════════════════════════ */
window.TEAM = (() => {
  let _all = [];
  let _filtered = [];
  let _currentDept = 'all';
  let _searchTerm = '';
  let _editingId = null;
  let _currentDetailId = null;

  const DEPT_LABELS = {
    direcao:        '👑 Direção',
    producao:       '🎬 Produção',
    criacao:        '🎨 Criação',
    comercial:      '🤝 Comercial',
    operacoes:      '⚙️ Operações',
    tecnologia:     '💻 Tecnologia',
    administrativo: '📋 Administrativo'
  };

  const STATUS_LABELS = {
    ativo:      { label: 'Ativo',      color: '#00ff88' },
    ferias:     { label: 'Férias',     color: '#ffcc00' },
    afastado:   { label: 'Afastado',   color: '#ff6600' },
    inativo:    { label: 'Inativo',    color: '#888' },
    freelancer: { label: 'Freelancer', color: '#00aaff' }
  };

  const CONTRACT_LABELS = {
    clt:        'CLT',
    pj:         'PJ',
    freelancer: 'Freelancer',
    socio:      'Sócio',
    estagiario: 'Estagiário'
  };

  // ── Load colaboradores ──────────────────────────────────
  async function load() {
    try {
      const r = await fetch('tables/age_team_members?limit=200');
      const json = await r.json();
      _all = (json.data || []).filter(m => !m.deleted);
      _all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      applyFilter();
      renderStats();
    } catch (e) {
      console.error('TEAM load error', e);
    }
  }

  function applyFilter() {
    _filtered = _all.filter(m => {
      const deptOk = _currentDept === 'all' || m.department === _currentDept;
      const term = _searchTerm.toLowerCase();
      const searchOk = !term ||
        (m.name || '').toLowerCase().includes(term) ||
        (m.role || '').toLowerCase().includes(term) ||
        (m.username || '').toLowerCase().includes(term);
      return deptOk && searchOk;
    });
    renderGrid();
  }

  function renderStats() {
    const el = document.getElementById('colabStats');
    if (!el) return;
    const ativos = _all.filter(m => m.status === 'ativo' || m.status === 'freelancer').length;
    const ferias = _all.filter(m => m.status === 'ferias').length;
    const inativos = _all.filter(m => m.status === 'inativo').length;
    el.innerHTML = `
      <div class="colab-stat"><span class="colab-stat-val">${_all.length}</span><span class="colab-stat-lbl">Total</span></div>
      <div class="colab-stat active"><span class="colab-stat-val">${ativos}</span><span class="colab-stat-lbl">Ativos</span></div>
      <div class="colab-stat warn"><span class="colab-stat-val">${ferias}</span><span class="colab-stat-lbl">Férias</span></div>
      <div class="colab-stat inactive"><span class="colab-stat-val">${inativos}</span><span class="colab-stat-lbl">Inativos</span></div>
    `;
  }

  function renderGrid() {
    const el = document.getElementById('colabGrid');
    if (!el) return;
    if (_filtered.length === 0) {
      el.innerHTML = `<div class="colab-empty"><i class="fas fa-users-slash"></i><p>Nenhum colaborador encontrado</p><button class="btn-primary" onclick="TEAM.openNew()"><i class="fas fa-plus"></i> Adicionar</button></div>`;
      return;
    }

    el.innerHTML = _filtered.map(m => {
      const st = STATUS_LABELS[m.status] || STATUS_LABELS.ativo;
      const dept = DEPT_LABELS[m.department] || m.department || '';
      const contract = CONTRACT_LABELS[m.contract_type] || m.contract_type || '';
      const color = m.color || '#ff1a1a';
      const initials = m.avatar_initials || getInitials(m.name);
      const funcs = parseArray(m.functions);
      const skills = parseArray(m.skills);
      const joinedTxt = m.joined_date ? formatJoinedDate(m.joined_date) : '';

      return `
        <div class="colab-card" onclick="TEAM.showDetail('${m.id}')">
          <div class="colab-card-header" style="background: linear-gradient(135deg, ${color}22, transparent)">
            <div class="colab-avatar" style="background:${color}33;border:2px solid ${color};color:${color}">
              ${initials}
            </div>
            <div class="colab-card-info">
              <div class="colab-name">${m.name || '—'}</div>
              <div class="colab-role">${m.role || '—'}</div>
              <div class="colab-dept">${dept}</div>
            </div>
            <div class="colab-status-badge" style="background:${st.color}22;color:${st.color};border-color:${st.color}40">
              ${st.label}
            </div>
          </div>
          <div class="colab-card-body">
            ${contract ? `<div class="colab-tag"><i class="fas fa-file-contract"></i> ${contract}</div>` : ''}
            ${joinedTxt ? `<div class="colab-tag"><i class="fas fa-calendar-check"></i> Desde ${joinedTxt}</div>` : ''}
            ${m.email ? `<div class="colab-tag"><i class="fas fa-envelope"></i> ${m.email}</div>` : ''}
            ${m.phone ? `<div class="colab-tag"><i class="fab fa-whatsapp"></i> ${m.phone}</div>` : ''}
            ${funcs.length ? `<div class="colab-functions">${funcs.slice(0,3).map(f => `<span class="colab-func-tag">${f.trim()}</span>`).join('')}${funcs.length > 3 ? `<span class="colab-func-tag more">+${funcs.length-3}</span>` : ''}</div>` : ''}
            ${skills.length ? `<div class="colab-skills">${skills.slice(0,4).map(s => `<span class="colab-skill-tag">${s.trim()}</span>`).join('')}</div>` : ''}
          </div>
          <div class="colab-card-footer">
            <button class="btn-icon-sm" onclick="event.stopPropagation(); TEAMCAL.openNewEventFor('${m.id}')" title="Alocar no calendário">
              <i class="fas fa-calendar-plus"></i>
            </button>
            <button class="btn-icon-sm" onclick="event.stopPropagation(); TEAM.openEdit('${m.id}')" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon-sm danger" onclick="event.stopPropagation(); TEAM.confirmDelete('${m.id}', '${(m.name||'').replace(/'/g,"\\'")}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function showDetail(id) {
    const m = _all.find(x => x.id === id);
    if (!m) return;
    _currentDetailId = id;
    const st = STATUS_LABELS[m.status] || STATUS_LABELS.ativo;
    const dept = DEPT_LABELS[m.department] || m.department || '';
    const contract = CONTRACT_LABELS[m.contract_type] || m.contract_type || '';
    const funcs = parseArray(m.functions);
    const skills = parseArray(m.skills);
    const color = m.color || '#ff1a1a';
    const initials = m.avatar_initials || getInitials(m.name);

    document.getElementById('modalColabDetailTitle').textContent = (m.name || '').toUpperCase();
    document.getElementById('modalColabDetailBody').innerHTML = `
      <div class="colab-detail-top">
        <div class="colab-detail-avatar" style="background:${color}33;border:3px solid ${color};color:${color}">${initials}</div>
        <div>
          <div class="colab-detail-name">${m.name}</div>
          <div class="colab-detail-role">${m.role || '—'}</div>
          <div class="colab-detail-dept">${dept}</div>
          <span class="colab-status-badge" style="background:${st.color}22;color:${st.color};border-color:${st.color}40">${st.label}</span>
        </div>
      </div>
      <div class="colab-detail-grid">
        ${m.username ? `<div class="colab-detail-item"><i class="fas fa-user"></i><span>@${m.username}</span></div>` : ''}
        ${contract ? `<div class="colab-detail-item"><i class="fas fa-file-contract"></i><span>${contract}</span></div>` : ''}
        ${m.email ? `<div class="colab-detail-item"><i class="fas fa-envelope"></i><span>${m.email}</span></div>` : ''}
        ${m.phone ? `<div class="colab-detail-item"><i class="fab fa-whatsapp"></i><span>${m.phone}</span></div>` : ''}
        ${m.joined_date ? `<div class="colab-detail-item"><i class="fas fa-calendar-check"></i><span>Entrada: ${formatJoinedDate(m.joined_date)}</span></div>` : ''}
      </div>
      ${funcs.length ? `
        <div class="colab-detail-section">
          <div class="colab-detail-section-title">FUNÇÕES</div>
          <div class="colab-functions">${funcs.map(f => `<span class="colab-func-tag">${f.trim()}</span>`).join('')}</div>
        </div>` : ''}
      ${skills.length ? `
        <div class="colab-detail-section">
          <div class="colab-detail-section-title">HABILIDADES TÉCNICAS</div>
          <div class="colab-skills">${skills.map(s => `<span class="colab-skill-tag">${s.trim()}</span>`).join('')}</div>
        </div>` : ''}
      ${m.notes ? `
        <div class="colab-detail-section">
          <div class="colab-detail-section-title">OBSERVAÇÕES</div>
          <div class="colab-detail-notes">${m.notes}</div>
        </div>` : ''}
    `;
    openModal('modalColabDetail');
  }

  function editFromDetail() {
    closeModal('modalColabDetail');
    if (_currentDetailId) openEdit(_currentDetailId);
  }

  function openNew() {
    _editingId = null;
    document.getElementById('modalColabTitle').textContent = 'NOVO COLABORADOR';
    clearForm();
    openModal('modalColab');
  }

  function openEdit(id) {
    const m = _all.find(x => x.id === id);
    if (!m) return;
    _editingId = id;
    document.getElementById('modalColabTitle').textContent = 'EDITAR COLABORADOR';
    fillForm(m);
    openModal('modalColab');
  }

  function clearForm() {
    document.getElementById('editColabId').value = '';
    document.getElementById('colabName').value = '';
    document.getElementById('colabUsername').value = '';
    document.getElementById('colabRole').value = '';
    document.getElementById('colabDept').value = 'producao';
    document.getElementById('colabStatus').value = 'ativo';
    document.getElementById('colabContract').value = 'pj';
    document.getElementById('colabEmail').value = '';
    document.getElementById('colabPhone').value = '';
    document.getElementById('colabJoined').value = '';
    document.getElementById('colabColor').value = '#ff1a1a';
    document.getElementById('colabFunctions').value = '';
    document.getElementById('colabSkills').value = '';
    document.getElementById('colabNotes').value = '';
  }

  function fillForm(m) {
    document.getElementById('editColabId').value = m.id || '';
    document.getElementById('colabName').value = m.name || '';
    document.getElementById('colabUsername').value = m.username || '';
    document.getElementById('colabRole').value = m.role || '';
    document.getElementById('colabDept').value = m.department || 'producao';
    document.getElementById('colabStatus').value = m.status || 'ativo';
    document.getElementById('colabContract').value = m.contract_type || 'pj';
    document.getElementById('colabEmail').value = m.email || '';
    document.getElementById('colabPhone').value = m.phone || '';
    document.getElementById('colabJoined').value = m.joined_date || '';
    document.getElementById('colabColor').value = m.color || '#ff1a1a';
    document.getElementById('colabFunctions').value = parseArray(m.functions).join(', ');
    document.getElementById('colabSkills').value = parseArray(m.skills).join(', ');
    document.getElementById('colabNotes').value = m.notes || '';
  }

  async function save() {
    const name = document.getElementById('colabName').value.trim();
    if (!name) { showToast('Informe o nome do colaborador', 'fa-exclamation-circle'); return; }

    const funcsRaw = document.getElementById('colabFunctions').value;
    const skillsRaw = document.getElementById('colabSkills').value;
    const funcs = funcsRaw ? funcsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const skills = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const username = document.getElementById('colabUsername').value.trim();

    const data = {
      name,
      username,
      role:           document.getElementById('colabRole').value.trim(),
      department:     document.getElementById('colabDept').value,
      status:         document.getElementById('colabStatus').value,
      contract_type:  document.getElementById('colabContract').value,
      email:          document.getElementById('colabEmail').value.trim(),
      phone:          document.getElementById('colabPhone').value.trim(),
      joined_date:    document.getElementById('colabJoined').value,
      color:          document.getElementById('colabColor').value,
      functions:      funcs,
      skills:         skills,
      notes:          document.getElementById('colabNotes').value.trim(),
      avatar_initials: getInitials(name),
      deleted:        false
    };

    try {
      const editId = document.getElementById('editColabId').value;
      let url = 'tables/age_team_members';
      let method = 'POST';
      if (editId) { url += `/${editId}`; method = 'PUT'; }

      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!resp.ok) throw new Error('Erro ao salvar');
      closeModal('modalColab');
      showToast(editId ? 'Colaborador atualizado!' : 'Colaborador cadastrado!', 'fa-check-circle');
      await load();
      // Notificar calendário para atualizar membros
      if (window.TEAMCAL) window.TEAMCAL.refreshMembers();
    } catch (e) {
      showToast('Erro ao salvar colaborador', 'fa-exclamation-circle');
    }
  }

  function confirmDelete(id, name) {
    if (window.showConfirm) {
      window.showConfirm(`Remover colaborador "${name}"?`, () => deleteColab(id));
    } else if (confirm(`Remover colaborador "${name}"?`)) {
      deleteColab(id);
    }
  }

  async function deleteColab(id) {
    try {
      await fetch(`tables/age_team_members/${id}`, { method: 'DELETE' });
      showToast('Colaborador removido', 'fa-check-circle');
      await load();
      if (window.TEAMCAL) window.TEAMCAL.refreshMembers();
    } catch (e) {
      showToast('Erro ao remover', 'fa-exclamation-circle');
    }
  }

  function filterDept(dept) {
    _currentDept = dept;
    document.querySelectorAll('.colab-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.dept === dept);
    });
    applyFilter();
  }

  function search(term) {
    _searchTerm = term;
    applyFilter();
  }

  function openCalendar() {
    if (window.navigate) navigate('team-calendar');
  }

  function onNavigate() {
    load();
  }

  // Getters públicos
  function getAll() { return _all; }

  // Helpers
  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
    return (name.substring(0, 2)).toUpperCase();
  }

  function parseArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; }
      catch { return val.split(',').map(s => s.trim()).filter(Boolean); }
    }
    return [];
  }

  function formatJoinedDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  }

  return { load, onNavigate, openNew, openEdit, save, confirmDelete, showDetail, editFromDetail, filterDept, search, openCalendar, getAll, getInitials, parseArray };
})();


/* ══════════════════════════════════════════════════════════
   TEAMCAL — CALENDÁRIO DA EQUIPE
   ══════════════════════════════════════════════════════════ */
window.TEAMCAL = (() => {
  let _events = [];
  let _members = [];
  let _currentDate = new Date();
  let _viewMode = 'month'; // 'month' | 'week'
  let _filterMember = 'all';
  let _preselectedMember = null;
  let _editingEventId = null;

  const EVENT_TYPES = {
    gravacao:     { label: '🎬 Gravação',      color: '#ff1a1a' },
    reuniao:      { label: '🤝 Reunião',        color: '#00aaff' },
    edicao:       { label: '✂️ Edição',         color: '#cc44ff' },
    entrega:      { label: '📦 Entrega',        color: '#00ff88' },
    pre_producao: { label: '📋 Pré-produção',   color: '#ffcc00' },
    evento:       { label: '🎪 Evento',         color: '#ff8800' },
    folga:        { label: '🌴 Folga/Férias',   color: '#888888' },
    outro:        { label: '📌 Outro',          color: '#aaaaaa' }
  };

  // ── Load events ─────────────────────────────────────────
  async function loadEvents() {
    try {
      const r = await fetch('tables/age_team_calendar?limit=500');
      const json = await r.json();
      _events = (json.data || []).filter(e => !e.deleted);
    } catch (e) {
      console.error('TEAMCAL loadEvents error', e);
    }
  }

  async function loadMembers() {
    _members = window.TEAM ? window.TEAM.getAll() : [];
    if (_members.length === 0) {
      try {
        const r = await fetch('tables/age_team_members?limit=200');
        const json = await r.json();
        _members = (json.data || []).filter(m => !m.deleted);
      } catch(e) {}
    }
    renderMemberFilter();
    populateMemberSelects();
  }

  function renderMemberFilter() {
    const el = document.getElementById('teamcalMemberFilter');
    if (!el) return;
    const memberBtns = _members.map(m => {
      const color = m.color || '#ff1a1a';
      const initials = m.avatar_initials || window.TEAM?.getInitials(m.name) || '??';
      return `
        <button class="teamcal-member-btn" data-member="${m.id}" onclick="TEAMCAL.filterMember('${m.id}')"
                style="--mc:${color}">
          <span class="teamcal-member-dot" style="background:${color}"></span>
          ${(m.name || '').split(' ')[0].toUpperCase()}
        </button>
      `;
    }).join('');

    // Preserve the "Todos" button and replace rest
    el.innerHTML = `
      <button class="teamcal-member-btn ${_filterMember === 'all' ? 'active' : ''}" data-member="all" onclick="TEAMCAL.filterMember('all')">
        <i class="fas fa-users"></i> Todos
      </button>
      ${memberBtns}
    `;
    // Re-apply active state
    el.querySelectorAll('.teamcal-member-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.member === _filterMember);
    });
  }

  function renderLegend() {
    const el = document.getElementById('teamcalLegend');
    if (!el) return;
    el.innerHTML = `<div class="teamcal-legend-title">MEMBROS:</div>` +
      _members.map(m => {
        const color = m.color || '#ff1a1a';
        return `<div class="teamcal-legend-item"><span class="teamcal-legend-dot" style="background:${color}"></span>${m.name}</div>`;
      }).join('') +
      `<div class="teamcal-legend-title" style="margin-left:24px">TIPOS:</div>` +
      Object.entries(EVENT_TYPES).map(([k, v]) => `
        <div class="teamcal-legend-item">
          <span class="teamcal-legend-dot" style="background:${v.color}"></span>${v.label}
        </div>`).join('');
  }

  function populateMemberSelects() {
    const sel = document.getElementById('teamEventMember');
    if (!sel) return;
    sel.innerHTML = `<option value="">— Selecionar —</option>` +
      _members.map(m => `<option value="${m.id}">${m.name} (${m.role || m.department || ''})</option>`).join('');
    if (_preselectedMember) sel.value = _preselectedMember;
  }

  // ── Render Month View ────────────────────────────────────
  function renderMonthView() {
    const el = document.getElementById('teamcalGrid');
    if (!el) return;

    const year = _currentDate.getFullYear();
    const month = _currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    const today = new Date();
    const todayStr = toDateStr(today);

    // Update label
    const lbl = document.getElementById('teamcalMonthLabel');
    if (lbl) lbl.textContent = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

    const cells = [];
    // Empty cells before start
    for (let i = 0; i < startDow; i++) cells.push('<div class="teamcal-cell empty"></div>');

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      const dayEvents = getEventsForDate(dateStr);
      const eventsHtml = dayEvents.slice(0,3).map(ev => renderEventChip(ev)).join('');
      const moreHtml = dayEvents.length > 3 ? `<div class="teamcal-more">+${dayEvents.length - 3} mais</div>` : '';

      cells.push(`
        <div class="teamcal-cell ${isToday ? 'today' : ''}" onclick="TEAMCAL.openNewEventDate('${dateStr}')">
          <div class="teamcal-day-num ${isToday ? 'today' : ''}">${d}</div>
          <div class="teamcal-day-events">${eventsHtml}${moreHtml}</div>
        </div>
      `);
    }

    el.innerHTML = cells.join('');
  }

  // ── Render Week View ─────────────────────────────────────
  function renderWeekView() {
    const el = document.getElementById('teamcalWeekGrid');
    if (!el) return;

    const weekStart = getWeekStart(_currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }

    const today = new Date();
    const todayStr = toDateStr(today);

    // Update month label
    const lbl = document.getElementById('teamcalMonthLabel');
    if (lbl) {
      const s = days[0].toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
      const e = days[6].toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
      lbl.textContent = `${s} — ${e}`.toUpperCase();
    }

    const dayNames = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
    el.innerHTML = days.map((d, idx) => {
      const dateStr = toDateStr(d);
      const isToday = dateStr === todayStr;
      const dayEvents = getEventsForDate(dateStr);
      return `
        <div class="teamcal-week-col ${isToday ? 'today' : ''}">
          <div class="teamcal-week-header">
            <span class="teamcal-week-day">${dayNames[idx]}</span>
            <span class="teamcal-week-num ${isToday ? 'today' : ''}">${d.getDate()}</span>
          </div>
          <div class="teamcal-week-events" onclick="TEAMCAL.openNewEventDate('${dateStr}')">
            ${dayEvents.map(ev => renderEventChip(ev, true)).join('')}
            ${dayEvents.length === 0 ? `<div class="teamcal-week-empty"><i class="fas fa-plus"></i></div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderEventChip(ev, detailed = false) {
    const member = _members.find(m => m.id === ev.member_id);
    const memberColor = member?.color || ev.member_color || '#888';
    const evType = EVENT_TYPES[ev.event_type] || EVENT_TYPES.outro;
    const typeColor = evType.color;
    const timeStr = ev.time_start ? ev.time_start.substring(0,5) : '';

    if (detailed) {
      return `
        <div class="teamcal-event-chip detailed" style="border-left:3px solid ${typeColor};background:${typeColor}18"
             onclick="event.stopPropagation(); TEAMCAL.showEventDetail('${ev.id}')">
          <div class="teamcal-chip-title">${ev.title || '—'}</div>
          <div class="teamcal-chip-meta">
            ${timeStr ? `<span>${timeStr}</span>` : ''}
            ${member ? `<span style="color:${memberColor}">● ${member.name.split(' ')[0]}</span>` : ''}
          </div>
        </div>
      `;
    }
    return `
      <div class="teamcal-event-chip" style="background:${typeColor}22;border-left:2px solid ${typeColor};color:${typeColor}"
           onclick="event.stopPropagation(); TEAMCAL.showEventDetail('${ev.id}')">
        ${timeStr ? `<span class="chip-time">${timeStr}</span>` : ''}
        <span class="chip-title">${ev.title || '—'}</span>
      </div>
    `;
  }

  function getEventsForDate(dateStr) {
    return _events.filter(ev => {
      if (_filterMember !== 'all' && ev.member_id !== _filterMember) return false;
      // Check if date is in range
      if (ev.date_start === dateStr) return true;
      if (ev.date_end && ev.date_start <= dateStr && ev.date_end >= dateStr) return true;
      return false;
    });
  }

  function showEventDetail(id) {
    const ev = _events.find(e => e.id === id);
    if (!ev) return;
    const member = _members.find(m => m.id === ev.member_id);
    const evType = EVENT_TYPES[ev.event_type] || EVENT_TYPES.outro;
    const timeStr = [ev.time_start, ev.time_end].filter(Boolean).map(t => t.substring(0,5)).join(' – ');
    const dateStr = ev.date_end && ev.date_end !== ev.date_start
      ? `${formatDateBR(ev.date_start)} → ${formatDateBR(ev.date_end)}`
      : formatDateBR(ev.date_start);

    if (confirm(`📅 ${ev.title}\n\n👤 ${member?.name || '—'}\n${evType.label}\n🗓 ${dateStr}${timeStr ? '\n⏰ ' + timeStr : ''}${ev.location ? '\n📍 ' + ev.location : ''}${ev.notes ? '\n📝 ' + ev.notes : ''}\n\n✏️ Editar este evento?`)) {
      openEditEvent(id);
    }
  }

  // ── Navigation ───────────────────────────────────────────
  function prevMonth() {
    if (_viewMode === 'month') {
      _currentDate.setMonth(_currentDate.getMonth() - 1);
    } else {
      _currentDate.setDate(_currentDate.getDate() - 7);
    }
    render();
  }

  function nextMonth() {
    if (_viewMode === 'month') {
      _currentDate.setMonth(_currentDate.getMonth() + 1);
    } else {
      _currentDate.setDate(_currentDate.getDate() + 7);
    }
    render();
  }

  function goToday() {
    _currentDate = new Date();
    render();
  }

  function toggleView() {
    _viewMode = _viewMode === 'month' ? 'week' : 'month';
    document.getElementById('teamcalViewLabel').textContent = _viewMode === 'month' ? 'Semana' : 'Mês';
    document.getElementById('teamcalMonthView').style.display = _viewMode === 'month' ? '' : 'none';
    document.getElementById('teamcalWeekView').style.display = _viewMode === 'week' ? '' : 'none';
    render();
  }

  function filterMember(memberId) {
    _filterMember = memberId;
    document.querySelectorAll('.teamcal-member-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.member === memberId);
    });
    render();
  }

  function render() {
    if (_viewMode === 'month') renderMonthView();
    else renderWeekView();
    renderLegend();
  }

  // ── Event CRUD ───────────────────────────────────────────
  function openNewEvent() {
    _editingEventId = null;
    _preselectedMember = null;
    document.getElementById('modalTeamEventTitle').textContent = 'NOVO EVENTO';
    clearEventForm();
    populateProjectSelect();
    openModal('modalTeamEvent');
  }

  function openNewEventFor(memberId) {
    _preselectedMember = memberId || null;
    openNewEvent();
    if (memberId) {
      const sel = document.getElementById('teamEventMember');
      if (sel) sel.value = memberId;
    }
  }

  function openNewEventDate(dateStr) {
    openNewEvent();
    const dateEl = document.getElementById('teamEventDate');
    if (dateEl) dateEl.value = dateStr;
  }

  function openEditEvent(id) {
    const ev = _events.find(e => e.id === id);
    if (!ev) return;
    _editingEventId = id;
    document.getElementById('modalTeamEventTitle').textContent = 'EDITAR EVENTO';
    fillEventForm(ev);
    populateProjectSelect(ev.project_id);
    openModal('modalTeamEvent');
  }

  function clearEventForm() {
    document.getElementById('editTeamEventId').value = '';
    document.getElementById('teamEventTitle').value = '';
    document.getElementById('teamEventType').value = 'gravacao';
    document.getElementById('teamEventDate').value = '';
    document.getElementById('teamEventDateEnd').value = '';
    document.getElementById('teamEventTimeStart').value = '';
    document.getElementById('teamEventTimeEnd').value = '';
    document.getElementById('teamEventLocation').value = '';
    document.getElementById('teamEventNotes').value = '';
    const sel = document.getElementById('teamEventMember');
    if (sel) sel.value = '';
  }

  function fillEventForm(ev) {
    document.getElementById('editTeamEventId').value = ev.id || '';
    document.getElementById('teamEventTitle').value = ev.title || '';
    document.getElementById('teamEventType').value = ev.event_type || 'gravacao';
    document.getElementById('teamEventDate').value = ev.date_start || '';
    document.getElementById('teamEventDateEnd').value = ev.date_end || '';
    document.getElementById('teamEventTimeStart').value = ev.time_start || '';
    document.getElementById('teamEventTimeEnd').value = ev.time_end || '';
    document.getElementById('teamEventLocation').value = ev.location || '';
    document.getElementById('teamEventNotes').value = ev.notes || '';
    const sel = document.getElementById('teamEventMember');
    if (sel) sel.value = ev.member_id || '';
  }

  async function populateProjectSelect(selectedId) {
    const sel = document.getElementById('teamEventProject');
    if (!sel) return;
    try {
      const r = await fetch('tables/age_projects?limit=200&sort=project_date');
      const json = await r.json();
      const projects = (json.data || []).filter(p => !p.deleted && p.status !== 'cancelado');
      sel.innerHTML = `<option value="">— Nenhum —</option>` +
        projects.map(p => `<option value="${p.id}">${p.client} — ${p.project_name}</option>`).join('');
      if (selectedId) sel.value = selectedId;
    } catch(e) {
      sel.innerHTML = `<option value="">— Nenhum —</option>`;
    }
  }

  async function saveEvent() {
    const title = document.getElementById('teamEventTitle').value.trim();
    const memberId = document.getElementById('teamEventMember').value;
    const dateStart = document.getElementById('teamEventDate').value;
    if (!title) { showToast('Informe o título do evento', 'fa-exclamation-circle'); return; }
    if (!memberId) { showToast('Selecione um membro', 'fa-exclamation-circle'); return; }
    if (!dateStart) { showToast('Informe a data', 'fa-exclamation-circle'); return; }

    const member = _members.find(m => m.id === memberId);
    const data = {
      title,
      member_id:    memberId,
      member_name:  member?.name || '',
      member_color: member?.color || '#888',
      event_type:   document.getElementById('teamEventType').value,
      date_start:   dateStart,
      date_end:     document.getElementById('teamEventDateEnd').value || dateStart,
      time_start:   document.getElementById('teamEventTimeStart').value,
      time_end:     document.getElementById('teamEventTimeEnd').value,
      location:     document.getElementById('teamEventLocation').value.trim(),
      notes:        document.getElementById('teamEventNotes').value.trim(),
      project_id:   document.getElementById('teamEventProject').value,
      deleted:      false
    };

    try {
      const editId = document.getElementById('editTeamEventId').value;
      let url = 'tables/age_team_calendar';
      let method = 'POST';
      if (editId) { url += `/${editId}`; method = 'PUT'; }
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!resp.ok) throw new Error('Erro');
      closeModal('modalTeamEvent');
      showToast(editId ? 'Evento atualizado!' : 'Evento criado!', 'fa-check-circle');
      await loadEvents();
      render();
    } catch(e) {
      showToast('Erro ao salvar evento', 'fa-exclamation-circle');
    }
  }

  async function refreshMembers() {
    await loadMembers();
    render();
  }

  async function onNavigate() {
    await Promise.all([loadMembers(), loadEvents()]);
    render();
  }

  // ── Helpers ──────────────────────────────────────────────
  function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function getWeekStart(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - day);
    return date;
  }

  return {
    onNavigate, render, prevMonth, nextMonth, goToday, toggleView,
    filterMember, openNewEvent, openNewEventFor, openNewEventDate,
    openEditEvent, saveEvent, showEventDetail, refreshMembers, populateMemberSelects
  };
})();
