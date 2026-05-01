/* ============================================================
   AGE OPS — OS-SCHEDULE.JS
   Cronograma Semanal da Equipe
   Tabela: age_team_schedule
   ============================================================ */

window.SCHED = (function () {

  /* ─── MEMBROS COM CORES ──────────────────────────────────── */
  const MEMBERS = [
    { username:'gustavowng',   name:'GUSTAVO',       color:'#ff1a1a', avatar:'GUS' },
    { username:'vraulin',      name:'VRAULIN',        color:'#00aaff', avatar:'VRA' },
    { username:'pedrobarreto', name:'PEDRO',          color:'#cc44ff', avatar:'PED' },
    { username:'paulin',       name:'PAULIN',         color:'#00ccff', avatar:'PAU' },
    { username:'vic',          name:'VIC',            color:'#aa44ff', avatar:'VIC' },
    { username:'amarante',     name:'AMARANTE',       color:'#ffcc00', avatar:'AMA' },
    { username:'ken',          name:'KEN',            color:'#ff6600', avatar:'KEN' },
  ];

  const TYPE_META = {
    gravacao : { label:'Gravação',  icon:'fa-video',        color:'#ff4444' },
    reuniao  : { label:'Reunião',   icon:'fa-handshake',    color:'#00aaff' },
    tarefa   : { label:'Tarefa',    icon:'fa-check-circle', color:'#00ff88' },
    entrega  : { label:'Entrega',   icon:'fa-box',          color:'#ffcc00' },
    evento   : { label:'Evento',    icon:'fa-star',         color:'#ff6600' },
    outro    : { label:'Outro',     icon:'fa-thumbtack',    color:'#aa88ff' },
  };

  const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const DAYS_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  /* ─── STATE ──────────────────────────────────────────────── */
  let _weekStart    = _getMonday(new Date());  // Date (segunda-feira)
  let _events       = [];                       // todos os eventos da semana
  let _filterMember = 'all';

  /* ─── ENTRY POINT ────────────────────────────────────────── */
  function onNavigate() {
    _weekStart = _getMonday(new Date());
    _render();
  }

  /* ─── NAVEGAÇÃO DE SEMANA ────────────────────────────────── */
  function prevWeek() { _weekStart = _addDays(_weekStart, -7); _render(); }
  function nextWeek() { _weekStart = _addDays(_weekStart,  7); _render(); }
  function goToday()  { _weekStart = _getMonday(new Date()); _render(); }

  /* ─── FILTRO DE MEMBRO ───────────────────────────────────── */
  function filterMember(val) {
    _filterMember = val;
    document.querySelectorAll('.sched-member-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.member === val);
    });
    _renderGrid();
  }

  /* ─── RENDER COMPLETO ────────────────────────────────────── */
  async function _render() {
    _updateWeekLabel();
    await _loadEvents();
    _renderGrid();
  }

  function _updateWeekLabel() {
    const end  = _addDays(_weekStart, 6);
    const fmt  = d => d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    const el   = document.getElementById('schedWeekLabel');
    if (el) el.textContent = `${fmt(_weekStart)} — ${fmt(end)}`;
  }

  /* ─── CARREGAR EVENTOS DA SEMANA ─────────────────────────── */
  async function _loadEvents() {
    const startStr = _fmt(_weekStart);
    const endStr   = _fmt(_addDays(_weekStart, 6));
    try {
      const res  = await fetch('tables/age_team_schedule?limit=500');
      const data = res.ok ? await res.json() : { data:[] };
      _events = (data.data || []).filter(e =>
        !e.deleted && e.day_date >= startStr && e.day_date <= endStr
      );
    } catch(e) { _events = []; }
  }

  /* ─── RENDERIZAR GRADE ───────────────────────────────────── */
  function _renderGrid() {
    const grid = document.getElementById('schedGrid');
    if (!grid) return;

    /* Dias da semana: seg → dom (7 colunas) */
    const days = Array.from({ length:7 }, (_, i) => _addDays(_weekStart, i));
    const today = _fmt(new Date());

    /* Filtrar membros */
    const members = _filterMember === 'all'
      ? MEMBERS
      : MEMBERS.filter(m => m.username === _filterMember);

    /* Cabeçalho de dias */
    let headerHtml = '<div class="sched-corner"></div>';
    days.forEach(d => {
      const ds    = _fmt(d);
      const isToday = ds === today;
      headerHtml += `<div class="sched-day-header${isToday?' today':''}">
        <span class="sched-day-abbr">${DAYS_PT[d.getDay()]}</span>
        <span class="sched-day-num${isToday?' today':''}">${d.getDate()}</span>
        <button class="sched-add-day-btn" title="Adicionar evento neste dia"
                onclick="window.SCHED.openModalForDay('${ds}')">
          <i class="fas fa-plus"></i>
        </button>
      </div>`;
    });

    /* Linhas de membros */
    let rowsHtml = '';
    members.forEach(m => {
      rowsHtml += `<div class="sched-member-row-label" style="border-left:3px solid ${m.color}">
        <div class="sched-member-avatar" style="background:${m.color}22;color:${m.color};border-color:${m.color}55">
          ${m.avatar}
        </div>
        <div class="sched-member-info">
          <div class="sched-member-name" style="color:${m.color}">${m.name}</div>
        </div>
      </div>`;

      days.forEach(d => {
        const ds = _fmt(d);
        const isToday = ds === today;
        const dayEvts = _events.filter(e =>
          e.assigned_to === m.username && e.day_date === ds
        ).sort((a,b) => (a.time_start||'').localeCompare(b.time_start||''));

        rowsHtml += `<div class="sched-cell${isToday?' today':''}" data-date="${ds}" data-member="${m.username}"
                          ondblclick="window.SCHED.openModalForMemberDay('${m.username}','${ds}')">
          ${dayEvts.map(e => _renderEventCard(e, m.color)).join('')}
          ${dayEvts.length === 0 ? `<div class="sched-cell-empty" onclick="window.SCHED.openModalForMemberDay('${m.username}','${ds}')">
            <i class="fas fa-plus"></i>
          </div>` : ''}
        </div>`;
      });
    });

    grid.innerHTML = `
      <div class="sched-header-row">${headerHtml}</div>
      <div class="sched-body">${rowsHtml}</div>`;
  }

  /* ─── CARD DE EVENTO ─────────────────────────────────────── */
  function _renderEventCard(e, memberColor) {
    const meta    = TYPE_META[e.type] || TYPE_META.outro;
    const timeStr = e.time_start ? e.time_start + (e.time_end ? '–'+e.time_end : '') : '';
    const done    = e.done === true || e.done === 'true';

    return `<div class="sched-event${done?' done':''}"
                 style="border-left-color:${meta.color};background:${meta.color}16"
                 title="${_escHtml(e.title||'')}${e.location?' — '+_escHtml(e.location):''}${e.notes?' · '+_escHtml(e.notes):''}">
      <div class="sched-event-top">
        <span class="sched-event-type" style="color:${meta.color}">
          <i class="fas ${meta.icon}"></i>
        </span>
        <div class="sched-event-actions">
          <button class="sched-evt-btn" title="${done?'Reabrir':'Concluir'}"
                  onclick="window.SCHED.toggleDone('${e.id}',${!done})">
            <i class="fas ${done?'fa-rotate-left':'fa-check'}"></i>
          </button>
          <button class="sched-evt-btn" title="Editar"
                  onclick="window.SCHED.editEvent('${e.id}')">
            <i class="fas fa-pen"></i>
          </button>
          <button class="sched-evt-btn danger" title="Excluir"
                  onclick="window.SCHED.deleteEvent('${e.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="sched-event-title">${_escHtml(e.title||'—')}</div>
      ${e.location ? `<div class="sched-event-loc"><i class="fas fa-map-marker-alt"></i> ${_escHtml(e.location)}</div>` : ''}
      ${timeStr     ? `<div class="sched-event-time"><i class="fas fa-clock"></i> ${timeStr}</div>` : ''}
      ${e.notes     ? `<div class="sched-event-notes">${_escHtml(e.notes)}</div>` : ''}
    </div>`;
  }

  /* ─── ABRIR MODAL (vazio) ────────────────────────────────── */
  function openModal(prefillMember, prefillDate) {
    document.getElementById('modalSchedTitle').textContent = 'NOVO EVENTO';
    document.getElementById('editSchedId').value   = '';
    document.getElementById('schedMember').value   = prefillMember || (currentUser?.username || 'gustavowng');
    document.getElementById('schedType').value     = 'gravacao';
    document.getElementById('schedTitle').value    = '';
    document.getElementById('schedDate').value     = prefillDate   || _fmt(new Date());
    document.getElementById('schedLocation').value = '';
    document.getElementById('schedTimeStart').value= '';
    document.getElementById('schedTimeEnd').value  = '';
    document.getElementById('schedNotes').value    = '';
    if (typeof openModal === 'function') openModal('modalSchedEvent');
    else document.getElementById('modalSchedEvent')?.classList.add('open');
  }

  function openModalForDay(date) {
    openModal(currentUser?.username || 'gustavowng', date);
  }

  function openModalForMemberDay(member, date) {
    openModal(member, date);
  }

  /* ─── EDITAR EVENTO ──────────────────────────────────────── */
  async function editEvent(id) {
    const e = _events.find(ev => ev.id === id);
    if (!e) return;
    document.getElementById('modalSchedTitle').textContent = 'EDITAR EVENTO';
    document.getElementById('editSchedId').value    = e.id;
    document.getElementById('schedMember').value    = e.assigned_to || '';
    document.getElementById('schedType').value      = e.type        || 'outro';
    document.getElementById('schedTitle').value     = e.title       || '';
    document.getElementById('schedDate').value      = e.day_date    || '';
    document.getElementById('schedLocation').value  = e.location    || '';
    document.getElementById('schedTimeStart').value = e.time_start  || '';
    document.getElementById('schedTimeEnd').value   = e.time_end    || '';
    document.getElementById('schedNotes').value     = e.notes       || '';
    document.getElementById('modalSchedEvent')?.classList.add('open');
  }

  /* ─── SALVAR EVENTO ──────────────────────────────────────── */
  async function saveEvent() {
    const id    = document.getElementById('editSchedId').value.trim();
    const title = document.getElementById('schedTitle').value.trim();
    const date  = document.getElementById('schedDate').value;

    if (!title) { if(typeof showToast==='function') showToast('Informe o título','fa-exclamation-triangle'); return; }
    if (!date)  { if(typeof showToast==='function') showToast('Informe a data','fa-exclamation-triangle'); return; }

    const d = new Date(date + 'T00:00:00');
    const payload = {
      assigned_to : document.getElementById('schedMember').value,
      type        : document.getElementById('schedType').value,
      title,
      day_date    : date,
      week_start  : _fmt(_getMonday(d)),
      day_label   : DAYS_FULL[d.getDay()],
      location    : document.getElementById('schedLocation').value.trim(),
      time_start  : document.getElementById('schedTimeStart').value,
      time_end    : document.getElementById('schedTimeEnd').value,
      notes       : document.getElementById('schedNotes').value.trim(),
      done        : false,
      created_by  : currentUser?.username || 'unknown',
    };

    try {
      const method = id ? 'PUT' : 'POST';
      const url    = id ? `tables/age_team_schedule/${id}` : 'tables/age_team_schedule';
      const res    = await fetch(url, {
        method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
      });
      if (res.ok) {
        if(typeof closeModal==='function') closeModal('modalSchedEvent');
        else document.getElementById('modalSchedEvent')?.classList.remove('open');
        if(typeof showToast==='function') showToast(id ? 'Evento atualizado!' : 'Evento criado!','fa-check-circle');
        /* Ir para a semana do evento */
        _weekStart = _getMonday(d);
        await _render();
      }
    } catch(err) {
      if(typeof showToast==='function') showToast('Erro ao salvar','fa-exclamation-triangle');
    }
  }

  /* ─── TOGGLE CONCLUÍDO ───────────────────────────────────── */
  async function toggleDone(id, doneVal) {
    try {
      await fetch(`tables/age_team_schedule/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ done: doneVal })
      });
      const ev = _events.find(e => e.id === id);
      if (ev) ev.done = doneVal;
      _renderGrid();
      if (window.GAME && doneVal) window.GAME.addXP(10);
    } catch(e) {}
  }

  /* ─── EXCLUIR EVENTO ─────────────────────────────────────── */
  function deleteEvent(id) {
    const ev = _events.find(e => e.id === id);
    const name = ev?.title || 'evento';
    if (typeof showConfirm === 'function') {
      showConfirm(`Excluir <b>${_escHtml(name)}</b>?`, async () => {
        try {
          await fetch(`tables/age_team_schedule/${id}`, { method:'DELETE' });
          if(typeof showToast==='function') showToast('Evento excluído','fa-trash');
          await _render();
        } catch(e) {}
      });
    }
  }

  /* ─── HELPERS DE DATA ────────────────────────────────────── */
  function _getMonday(d) {
    const day  = d.getDay();  // 0=Dom
    const diff = (day === 0) ? -6 : 1 - day;
    const mon  = new Date(d);
    mon.setDate(d.getDate() + diff);
    mon.setHours(0,0,0,0);
    return mon;
  }

  function _addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function _fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function _escHtml(s) {
    return String(s||'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ─── API PÚBLICA ────────────────────────────────────────── */
  return {
    onNavigate,
    prevWeek,
    nextWeek,
    goToday,
    filterMember,
    openModal,
    openModalForDay,
    openModalForMemberDay,
    editEvent,
    saveEvent,
    toggleDone,
    deleteEvent,
  };

})();

/* ── WRAPPERS GLOBAIS ─────────────────────────────────────── */
function schedPrevWeek()                    { window.SCHED.prevWeek(); }
function schedNextWeek()                    { window.SCHED.nextWeek(); }
function schedGoToday()                     { window.SCHED.goToday(); }
function schedFilterMember(v)               { window.SCHED.filterMember(v); }
function openSchedModal()                   { window.SCHED.openModal(); }
function saveSchedEvent()                   { window.SCHED.saveEvent(); }


