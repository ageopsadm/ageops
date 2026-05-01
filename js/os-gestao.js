/* ============================================================
   AGE OPS — OS-GESTAO.JS
   Módulo: Gestão de Projetos — Pipeline Kanban
   ============================================================ */

window.GESTAO = (() => {

  /* ── Definição das etapas do pipeline ─────────────────── */
  const STAGES = [
    { id: 'reuniao',          label: '🤝 Reunião',          color: '#00aaff' },
    { id: 'pre_producao',     label: '📋 Pré-produção',     color: '#ffcc00' },
    { id: 'orcamento',        label: '💰 Orçamento',        color: '#ff8800' },
    { id: 'gravacao',         label: '🎬 Gravação',         color: '#ff1a1a' },
    { id: 'edicao',           label: '✂️ Edição',            color: '#cc44ff' },
    { id: 'finalizacao',      label: '🔧 Finalização',      color: '#ff44aa' },
    { id: 'entrega_aprovada', label: '✅ Entrega Aprovada', color: '#00ff88' },
    { id: 'postado',          label: '🚀 Postado',          color: '#aaffcc' }
  ];

  const PRIORITY_COLORS = {
    alta:  { color: '#ff1a1a', icon: '🔴', label: 'Alta' },
    media: { color: '#ffcc00', icon: '🟡', label: 'Média' },
    baixa: { color: '#00ff88', icon: '🟢', label: 'Baixa' }
  };

  const CATEGORY_LABELS = {
    evento:              '🎪 Evento',
    publicidade:         '📢 Publicidade',
    campanha:            '📣 Campanha',
    clipe:               '🎵 Clipe',
    producao_recorrente: '🔄 Recorrente'
  };

  let _cards = [];
  let _filtered = [];
  let _members = [];
  let _searchTerm = '';
  let _filterPriority = '';
  let _filterResponsible = '';
  let _editingId = null;
  let _currentDetailId = null;

  /* ── Drag & Drop state ─────────────────────────────────── */
  let _dragId = null;

  /* ── Load ──────────────────────────────────────────────── */
  async function load() {
    try {
      const r = await fetch('tables/age_project_stages?limit=300');
      const json = await r.json();
      _cards = (json.data || []).filter(c => !c.deleted);
      _cards.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      applyFilter();
    } catch(e) {
      console.error('GESTAO load error', e);
    }
  }

  async function loadMembers() {
    try {
      const r = await fetch('tables/age_team_members?limit=200');
      const json = await r.json();
      _members = (json.data || []).filter(m => !m.deleted && m.status !== 'inativo');
      populateMemberSelects();
    } catch(e) {}
  }

  function populateMemberSelects() {
    // Filter bar responsible
    const filterSel = document.getElementById('gestaoResponsible');
    if (filterSel) {
      filterSel.innerHTML = `<option value="">Todos responsáveis</option>` +
        _members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
    // Modal responsible
    const inputSel = document.getElementById('gestaoResponsibleInput');
    if (inputSel) {
      inputSel.innerHTML = `<option value="">— Selecionar —</option>` +
        _members.map(m => `<option value="${m.id}">${m.name} (${m.role || m.department || ''})</option>`).join('');
    }
  }

  /* ── Filtering ─────────────────────────────────────────── */
  function applyFilter() {
    _filtered = _cards.filter(c => {
      const term = _searchTerm.toLowerCase();
      const searchOk = !term ||
        (c.project_name || '').toLowerCase().includes(term) ||
        (c.client || '').toLowerCase().includes(term);
      const prioOk = !_filterPriority || c.priority === _filterPriority;
      const respOk = !_filterResponsible || c.responsible === _filterResponsible;
      return searchOk && prioOk && respOk;
    });
    renderBoard();
  }

  function search(term) { _searchTerm = term; applyFilter(); }
  function filterPriority(val) { _filterPriority = val; applyFilter(); }
  function filterResponsible(val) { _filterResponsible = val; applyFilter(); }

  /* ── Render Board ──────────────────────────────────────── */
  function renderBoard() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    board.innerHTML = STAGES.map(stage => {
      const stageCards = _filtered.filter(c => c.stage === stage.id);
      const totalValue = stageCards.reduce((s, c) => s + (parseFloat(c.value) || 0), 0);
      return `
        <div class="kanban-col" data-stage="${stage.id}"
             ondragover="GESTAO.onDragOver(event)" ondrop="GESTAO.onDrop(event, '${stage.id}')">
          <div class="kanban-col-header" style="border-color:${stage.color}">
            <span class="kanban-col-title" style="color:${stage.color}">${stage.label}</span>
            <div class="kanban-col-meta">
              <span class="kanban-col-count">${stageCards.length}</span>
              ${totalValue > 0 ? `<span class="kanban-col-value">${formatCurrency(totalValue)}</span>` : ''}
            </div>
          </div>
          <div class="kanban-col-body" id="col-${stage.id}">
            ${stageCards.length === 0
              ? `<div class="kanban-empty-col" onclick="GESTAO.openNewCardInStage('${stage.id}')"><i class="fas fa-plus"></i> Adicionar</div>`
              : stageCards.map(c => renderCard(c, stage.color)).join('')
            }
          </div>
          <div class="kanban-col-footer">
            <button class="kanban-add-btn" onclick="GESTAO.openNewCardInStage('${stage.id}')">
              <i class="fas fa-plus"></i> Card
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderCard(c, stageColor) {
    const prio = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.media;
    const member = _members.find(m => m.id === c.responsible);
    const memberColor = member?.color || '#888';
    const memberInitials = member ? (window.TEAM?.getInitials(member.name) || member.name.substring(0,2).toUpperCase()) : '??';
    const cardColor = c.color || stageColor || '#ff1a1a';
    const dueTxt = c.due_date ? formatDateBR(c.due_date) : '';
    const isOverdue = c.due_date && new Date(c.due_date + 'T00:00:00') < new Date() && c.stage !== 'postado';

    return `
      <div class="kanban-card" draggable="true"
           style="border-left:3px solid ${cardColor}"
           ondragstart="GESTAO.onDragStart(event, '${c.id}')"
           ondragend="GESTAO.onDragEnd(event)"
           onclick="GESTAO.showDetail('${c.id}')">
        <div class="kanban-card-header">
          <span class="kanban-card-client">${c.client || '—'}</span>
          <span class="kanban-prio-badge" style="color:${prio.color}">${prio.icon}</span>
        </div>
        <div class="kanban-card-title">${c.project_name || '—'}</div>
        ${c.category ? `<div class="kanban-cat-tag">${CATEGORY_LABELS[c.category] || c.category}</div>` : ''}
        <div class="kanban-card-footer">
          ${c.value ? `<span class="kanban-card-value">${formatCurrency(c.value)}</span>` : ''}
          ${dueTxt ? `<span class="kanban-card-due ${isOverdue ? 'overdue' : ''}"><i class="fas fa-clock"></i> ${dueTxt}</span>` : ''}
          ${member ? `<span class="kanban-member-dot" style="background:${memberColor}33;color:${memberColor};border-color:${memberColor}55" title="${member.name}">${memberInitials}</span>` : ''}
        </div>
        ${c.stage_notes ? `<div class="kanban-card-notes">${c.stage_notes.substring(0,60)}${c.stage_notes.length > 60 ? '…' : ''}</div>` : ''}
      </div>
    `;
  }

  /* ── Detail Modal ──────────────────────────────────────── */
  function showDetail(id) {
    const c = _cards.find(x => x.id === id);
    if (!c) return;
    _currentDetailId = id;
    const stage = STAGES.find(s => s.id === c.stage) || STAGES[0];
    const prio = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.media;
    const member = _members.find(m => m.id === c.responsible);
    const cardColor = c.color || stage.color;

    document.getElementById('modalGestaoDetailTitle').textContent = (c.project_name || 'PROJETO').toUpperCase();

    // Pipeline progress bar
    const stageIdx = STAGES.findIndex(s => s.id === c.stage);
    const progressPct = Math.round(((stageIdx + 1) / STAGES.length) * 100);
    const pipelineHtml = `
      <div class="gestao-pipeline">
        ${STAGES.map((s, i) => `
          <div class="gestao-pipeline-step ${i <= stageIdx ? 'done' : ''} ${s.id === c.stage ? 'current' : ''}"
               onclick="GESTAO.quickMoveStage('${id}', '${s.id}')"
               title="Mover para: ${s.label}"
               style="${i <= stageIdx ? `--sc:${s.color}` : ''}">
            <div class="pipeline-step-dot" style="${s.id === c.stage ? `background:${s.color};box-shadow:0 0 8px ${s.color}` : i < stageIdx ? `background:${s.color}55` : ''}"></div>
            <div class="pipeline-step-label">${s.label}</div>
          </div>
        `).join('')}
      </div>
      <div class="gestao-progress-bar-wrap">
        <div class="gestao-progress-bar" style="width:${progressPct}%;background:${stage.color}"></div>
      </div>
    `;

    document.getElementById('modalGestaoDetailBody').innerHTML = `
      ${pipelineHtml}
      <div class="gestao-detail-info">
        <div class="gestao-detail-row"><span class="gd-label">CLIENTE</span><span class="gd-val">${c.client || '—'}</span></div>
        <div class="gestao-detail-row"><span class="gd-label">PROJETO</span><span class="gd-val">${c.project_name || '—'}</span></div>
        <div class="gestao-detail-row"><span class="gd-label">CATEGORIA</span><span class="gd-val">${CATEGORY_LABELS[c.category] || c.category || '—'}</span></div>
        <div class="gestao-detail-row"><span class="gd-label">PRIORIDADE</span><span class="gd-val" style="color:${prio.color}">${prio.icon} ${prio.label}</span></div>
        ${c.value ? `<div class="gestao-detail-row"><span class="gd-label">VALOR</span><span class="gd-val">${formatCurrency(c.value)}</span></div>` : ''}
        ${member ? `<div class="gestao-detail-row"><span class="gd-label">RESPONSÁVEL</span><span class="gd-val"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${member.color || '#888'};margin-right:6px"></span>${member.name}</span></div>` : ''}
        ${c.start_date ? `<div class="gestao-detail-row"><span class="gd-label">INÍCIO</span><span class="gd-val">${formatDateBR(c.start_date)}</span></div>` : ''}
        ${c.due_date ? `<div class="gestao-detail-row"><span class="gd-label">ENTREGA</span><span class="gd-val">${formatDateBR(c.due_date)}</span></div>` : ''}
        ${c.stage_notes ? `<div class="gestao-detail-row" style="grid-column:1/-1"><span class="gd-label">OBSERVAÇÕES</span><span class="gd-val">${c.stage_notes}</span></div>` : ''}
      </div>
      <div class="gestao-detail-actions-row">
        <button class="btn-ghost btn-sm" onclick="GESTAO.quickMoveBack('${id}')"><i class="fas fa-arrow-left"></i> Etapa anterior</button>
        <button class="btn-primary btn-sm" onclick="GESTAO.quickMoveNext('${id}')">Próxima etapa <i class="fas fa-arrow-right"></i></button>
      </div>
    `;
    openModal('modalGestaoDetail');
  }

  function editFromDetail() {
    closeModal('modalGestaoDetail');
    if (_currentDetailId) openEdit(_currentDetailId);
  }

  async function quickMoveStage(id, newStage) {
    await patchCard(id, { stage: newStage, stage_updated_at: new Date().toISOString() });
    closeModal('modalGestaoDetail');
  }

  async function quickMoveNext(id) {
    const c = _cards.find(x => x.id === id);
    if (!c) return;
    const idx = STAGES.findIndex(s => s.id === c.stage);
    if (idx < STAGES.length - 1) {
      await quickMoveStage(id, STAGES[idx + 1].id);
    }
  }

  async function quickMoveBack(id) {
    const c = _cards.find(x => x.id === id);
    if (!c) return;
    const idx = STAGES.findIndex(s => s.id === c.stage);
    if (idx > 0) {
      await quickMoveStage(id, STAGES[idx - 1].id);
    }
  }

  /* ── CRUD ──────────────────────────────────────────────── */
  function openNewCard() {
    _editingId = null;
    document.getElementById('modalGestaoTitle').textContent = 'NOVO CARD DE PROJETO';
    clearForm();
    openModal('modalGestao');
  }

  function openNewCardInStage(stageId) {
    openNewCard();
    const sel = document.getElementById('gestaoStage');
    if (sel) sel.value = stageId;
  }

  function openEdit(id) {
    const c = _cards.find(x => x.id === id);
    if (!c) return;
    _editingId = id;
    document.getElementById('modalGestaoTitle').textContent = 'EDITAR CARD';
    fillForm(c);
    openModal('modalGestao');
  }

  async function openFromProject() {
    // Import from age_projects
    try {
      const r = await fetch('tables/age_projects?limit=200');
      const json = await r.json();
      const projects = (json.data || []).filter(p => !p.deleted && p.status !== 'cancelado' && p.status !== 'concluido');
      const existingIds = _cards.map(c => c.project_id).filter(Boolean);
      const newProjects = projects.filter(p => !existingIds.includes(p.id));
      if (newProjects.length === 0) {
        showToast('Todos os projetos ativos já estão no Kanban', 'fa-info-circle');
        return;
      }
      if (confirm(`Importar ${newProjects.length} projeto(s) do sistema para o Kanban de Gestão?`)) {
        for (const p of newProjects) {
          // Mapear status do projeto para etapa do kanban
          const stageMap = {
            pendente:      'reuniao',
            em_andamento:  'gravacao',
            concluido:     'postado',
            cancelado:     'reuniao'
          };
          await fetch('tables/age_project_stages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id:   p.id,
              project_name: p.project_name || '',
              client:       p.client_name || '',
              category:     p.category || '',
              value:        parseFloat(p.total_value) || 0,
              stage:        stageMap[p.status] || 'reuniao',
              priority:     'media',
              start_date:   p.project_date || '',
              due_date:     p.payment_date || '',
              assigned_members: '',
              deleted:      false
            })
          });
        }
        showToast(`${newProjects.length} projeto(s) importado(s)!`, 'fa-check-circle');
        await load();
      }
    } catch(e) {
      showToast('Erro ao importar projetos', 'fa-exclamation-circle');
    }
  }

  function clearForm() {
    document.getElementById('editGestaoId').value = '';
    document.getElementById('gestaoName').value = '';
    document.getElementById('gestaoClient').value = '';
    document.getElementById('gestaoStage').value = 'reuniao';
    document.getElementById('gestaoPriorityInput').value = 'media';
    document.getElementById('gestaoResponsibleInput').value = '';
    document.getElementById('gestaoCategory').value = 'evento';
    document.getElementById('gestaoStartDate').value = '';
    document.getElementById('gestaoDueDate').value = '';
    document.getElementById('gestaoValue').value = '';
    document.getElementById('gestaoColor').value = '#ff1a1a';
    document.getElementById('gestaoNotes').value = '';
  }

  function fillForm(c) {
    document.getElementById('editGestaoId').value = c.id || '';
    document.getElementById('gestaoName').value = c.project_name || '';
    document.getElementById('gestaoClient').value = c.client || '';
    document.getElementById('gestaoStage').value = c.stage || 'reuniao';
    document.getElementById('gestaoPriorityInput').value = c.priority || 'media';
    document.getElementById('gestaoResponsibleInput').value = c.responsible || '';
    document.getElementById('gestaoCategory').value = c.category || 'evento';
    document.getElementById('gestaoStartDate').value = c.start_date || '';
    document.getElementById('gestaoDueDate').value = c.due_date || '';
    document.getElementById('gestaoValue').value = c.value || '';
    document.getElementById('gestaoColor').value = c.color || '#ff1a1a';
    document.getElementById('gestaoNotes').value = c.stage_notes || '';
  }

  async function save() {
    const name = document.getElementById('gestaoName').value.trim();
    const client = document.getElementById('gestaoClient').value.trim();
    if (!name) { showToast('Informe o nome do projeto', 'fa-exclamation-circle'); return; }

    const stage = document.getElementById('gestaoStage').value;
    const data = {
      project_name:     name,
      client,
      stage,
      priority:         document.getElementById('gestaoPriorityInput').value,
      responsible:      document.getElementById('gestaoResponsibleInput').value,
      category:         document.getElementById('gestaoCategory').value,
      start_date:       document.getElementById('gestaoStartDate').value,
      due_date:         document.getElementById('gestaoDueDate').value,
      value:            parseFloat(document.getElementById('gestaoValue').value) || 0,
      color:            document.getElementById('gestaoColor').value,
      stage_notes:      document.getElementById('gestaoNotes').value.trim(),
      stage_updated_at: new Date().toISOString(),
      deleted:          false
    };

    try {
      const editId = document.getElementById('editGestaoId').value;
      let url = 'tables/age_project_stages';
      let method = 'POST';
      if (editId) { url += `/${editId}`; method = 'PUT'; }
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!resp.ok) throw new Error('Erro');
      const saved = await resp.json();
      closeModal('modalGestao');
      showToast(editId ? 'Card atualizado!' : 'Card criado!', 'fa-check-circle');
      await load();
      // ── SYNC: ao criar/editar card com project_id, sincronizar com age_projects ──
      if (window.SYNC && saved.project_id) {
        await window.SYNC.onKanbanStageChanged({ ...saved, stage });
      }
      // Se o card tem valor, garantir que age_projects reflita
      if (window.SYNC && saved.project_id && saved.value > 0) {
        await fetch(`tables/age_projects/${saved.project_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ total_value: saved.value })
        }).catch(() => {});
      }
    } catch(e) {
      showToast('Erro ao salvar card', 'fa-exclamation-circle');
    }
  }

  async function patchCard(id, patch) {
    try {
      const r = await fetch(`tables/age_project_stages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      await load();
      // ── SYNC: se mudou etapa, propagar status para age_projects ──
      if (patch.stage && window.SYNC) {
        const card = _cards.find(c => c.id === id);
        if (card) await window.SYNC.onKanbanStageChanged({ ...card, stage: patch.stage });
      }
    } catch(e) {
      showToast('Erro ao atualizar card', 'fa-exclamation-circle');
    }
  }

  async function deleteCard(id) {
    try {
      await fetch(`tables/age_project_stages/${id}`, { method: 'DELETE' });
      showToast('Card removido', 'fa-check-circle');
      await load();
    } catch(e) {
      showToast('Erro ao remover card', 'fa-exclamation-circle');
    }
  }

  /* ── Drag & Drop ───────────────────────────────────────── */
  function onDragStart(event, cardId) {
    _dragId = cardId;
    event.dataTransfer.effectAllowed = 'move';
    event.target.classList.add('dragging');
  }

  function onDragEnd(event) {
    event.target.classList.remove('dragging');
    _dragId = null;
  }

  function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const col = event.currentTarget;
    col.classList.add('drag-over');
  }

  function onDrop(event, newStage) {
    event.preventDefault();
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
    if (!_dragId) return;
    const card = _cards.find(c => c.id === _dragId);
    patchCard(_dragId, { stage: newStage, stage_updated_at: new Date().toISOString() });
    // ── SYNC: propagar mudança de etapa para age_projects ──
    if (window.SYNC && card && card.project_id) {
      window.SYNC.onKanbanStageChanged({ ...card, stage: newStage });
    }
  }

  /* ── Lifecycle ─────────────────────────────────────────── */
  async function reload() {
    await load();
  }

  async function onNavigate() {
    await Promise.all([loadMembers(), load()]);
  }

  /* ── Helpers ────────────────────────────────────────────── */
  function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  return {
    onNavigate, reload, search, filterPriority, filterResponsible,
    openNewCard, openNewCardInStage, openEdit, openFromProject, save,
    showDetail, editFromDetail,
    quickMoveStage, quickMoveNext, quickMoveBack,
    onDragStart, onDragEnd, onDragOver, onDrop
  };
})();
