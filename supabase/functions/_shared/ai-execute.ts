import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type AgeUser = {
  id: string
  username?: string | null
  name?: string | null
  company_id?: string | null
  company_name?: string | null
  role?: string | null
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + (Number.isFinite(days) ? days : 0))
  return d.toISOString().slice(0, 10)
}

function mapProjectStatus(raw: unknown) {
  const s = String(raw || '').toLowerCase().trim()
  const map: Record<string, string> = {
    em_producao: 'em_andamento',
    producao: 'em_andamento',
    andamento: 'em_andamento',
    em_andamento: 'em_andamento',
    pendente: 'pendente',
    concluido: 'concluido',
    concluído: 'concluido',
    cancelado: 'cancelado',
  }
  return map[s] || (['pendente', 'em_andamento', 'concluido', 'cancelado'].includes(s) ? s : 'em_andamento')
}

function taskPriority(p: unknown) {
  const s = String(p || '').toLowerCase()
  if (s === 'alta') return 'alta'
  if (s === 'baixa') return 'baixa'
  return 'media'
}

function calTipo(raw: unknown) {
  const allowed = ['projeto', 'gravacao', 'reuniao', 'entrega', 'prazo', 'edicao', 'deslocamento', 'outro']
  const s = String(raw || '').toLowerCase().trim()
  return allowed.includes(s) ? s : 'outro'
}

function calTime(t: unknown) {
  if (t == null || t === '') return null
  const s = String(t).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  return `${String(m[1]).padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`
}

function extractTitles(d: Record<string, unknown>) {
  if (Array.isArray(d.tarefas)) return d.tarefas.map((t) => String(t || '').trim()).filter(Boolean)
  if (Array.isArray(d.titulos)) return d.titulos.map((t) => String(t || '').trim()).filter(Boolean)
  const raw = String(d.titulo || d.texto || '').trim()
  if (!raw) return []
  if (/[,;]/.test(raw)) {
    const parts = raw.split(/[,;]+/).map((s) => s.trim()).filter((s) => s.length > 1)
    if (parts.length > 1) return parts
  }
  return [raw]
}

async function insertDroppingUnknown(
  sb: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
) {
  const body = { ...payload }
  const dropped: string[] = []
  for (let i = 0; i < 8; i++) {
    const { data, error } = await sb.from(table).insert(body).select('*').maybeSingle()
    if (!error) return data
    const msg = String(error.message || '')
    const m = msg.match(/Could not find the '([^']+)' column/i)
      || msg.match(/column "?([a-zA-Z0-9_]+)"? of relation/i)
    const col = m?.[1]
    if (col && Object.prototype.hasOwnProperty.call(body, col)) {
      delete body[col]
      dropped.push(col)
      continue
    }
    throw new Error(error.message || `Falha ao gravar ${table}`)
  }
  throw new Error(`Falha ao gravar ${table} (colunas ausentes: ${dropped.join(', ')})`)
}

async function findProject(sb: SupabaseClient, companyId: string | null, name: string) {
  const q = String(name || '').trim().replace(/[%(),.*]/g, '').slice(0, 80)
  if (!q || !companyId) return null
  const { data } = await sb
    .from('age_projects')
    .select('id, project_name, title, client_name, status')
    .eq('company_id', companyId)
    .or(`project_name.ilike.%${q}%,title.ilike.%${q}%,client_name.ilike.%${q}%`)
    .limit(5)
  return (data && data[0]) || null
}

export async function executeAiAction(
  sb: SupabaseClient,
  user: AgeUser,
  acao: string,
  dados: Record<string, unknown>,
): Promise<string> {
  const companyId = user.company_id ? String(user.company_id) : null
  const me = String(user.username || 'whatsapp')
  const action = String(acao || '').toLowerCase().trim()

  if (action === 'criar_projeto') {
    const clientName = String(dados.cliente_nome || '').trim()
    const projName = String(dados.nome || '').trim()
    if (!clientName || !projName) throw new Error('Cliente e nome do projeto são obrigatórios.')
    const fat = dados.valor_total != null ? parseFloat(String(dados.valor_total)) : 0
    await insertDroppingUnknown(sb, 'age_projects', {
      company_id: companyId,
      client_name: clientName,
      project_name: projName,
      title: projName,
      category: 'Vídeo',
      segment: '',
      total_value: Number.isFinite(fat) ? fat : 0,
      cost: 0,
      profit_pct: 0,
      nps: 0,
      is_new_client: false,
      status: mapProjectStatus(dados.status),
      created_by: me,
      delivery_date: dados.data_entrega ? String(dados.data_entrega).slice(0, 10) : null,
    })
    return `Projeto "${projName}" criado para ${clientName}.`
  }

  if (action === 'criar_cliente') {
    const nome = String(dados.nome || '').trim()
    if (!nome) throw new Error('Nome do cliente é obrigatório.')
    const y = new Date().getFullYear()
    await insertDroppingUnknown(sb, 'age_clients_db', {
      company_id: companyId,
      client_name: nome,
      first_year: y,
      last_year: y,
      total_projects: 0,
      total_value: 0,
      status: 'ativo',
      notes: 'Criado pelo WhatsApp.',
      years_active: String(y),
    })
    return `Cliente "${nome}" adicionado.`
  }

  if (action === 'criar_orcamento') {
    const client = String(dados.cliente_nome || '').trim() || 'Cliente'
    const titulo = String(dados.titulo || '').trim() || 'Orçamento'
    const total = dados.valor_total != null ? parseFloat(String(dados.valor_total)) : 0
    const v = Math.max(Number.isFinite(total) ? total : 0, 1)
    const validadeDias = parseInt(String(dados.validade_dias ?? 15), 10)
    const dias = Number.isFinite(validadeDias) && validadeDias > 0 ? validadeDias : 15
    const builder = {
      version: 2,
      titulo,
      descricao: String(dados.descricao || '').trim(),
      diarias: 1,
      margemPct: 0,
      equipe: [],
      catalogo: [{ nome: 'Serviços', descricao: 'Item gerado pelo WhatsApp', valorUnit: v, quantidade: 1 }],
      despesas: [],
    }
    const { data: all } = await sb.from('age_orcamentos').select('numero').eq('company_id', companyId || '').limit(200)
    const maxNum = (all || []).reduce((mx: number, r: { numero?: string }) => {
      const m = String(r.numero || '').match(/(\d+)$/)
      return m ? Math.max(mx, parseInt(m[1], 10)) : mx
    }, 0)
    const numero = `ORC-${new Date().getFullYear()}-${String(maxNum + 1).padStart(3, '0')}`
    await insertDroppingUnknown(sb, 'age_orcamentos', {
      company_id: companyId,
      numero,
      client_name: client,
      project_name: titulo,
      date: todayISO(),
      validity: addDaysISO(dias),
      items_json: JSON.stringify(builder),
      discounts_json: JSON.stringify([]),
      subtotal: v,
      total_discounts: 0,
      imposto_pct: 0,
      imposto_valor: 0,
      total_value: v,
      payment_terms: 'À vista',
      notes: String(dados.descricao || '').trim(),
      status: 'rascunho',
      created_by: me,
    })
    return `Orçamento "${titulo}" (${numero}) criado para ${client}.`
  }

  if (action === 'criar_evento') {
    const titulo = String(dados.titulo || '').trim()
    const dataIni = String(dados.data_inicio || '').slice(0, 10)
    if (!companyId) throw new Error('Empresa não definida.')
    if (!titulo || !dataIni) throw new Error('Título e data são obrigatórios.')
    const dataFim = dados.data_fim ? String(dados.data_fim).slice(0, 10) : null
    const tipo = calTipo(dados.tipo)
    const multi = !!(dataFim && dataIni && dataFim > dataIni)
    await insertDroppingUnknown(sb, 'age_team_calendar', {
      company_id: companyId,
      titulo,
      descricao: dados.descricao ? String(dados.descricao).trim() : null,
      data_inicio: dataIni,
      data_fim: dataFim,
      hora_inicio: multi ? null : calTime(dados.hora_inicio),
      hora_fim: multi ? null : calTime(dados.hora_fim),
      tipo,
      responsavel_nome: dados.colaborador_nome || dados.responsavel_nome || null,
      dia_inteiro: multi,
      status: 'confirmado',
      created_at: Date.now(),
      updated_at: Date.now(),
    })
    return `Compromisso "${titulo}" marcado em ${dataIni}.`
  }

  if (action === 'criar_gasto') {
    const valor = parseFloat(String(dados.valor))
    const desc0 = String(dados.descricao || '').trim()
    if (!desc0 || !(valor > 0)) throw new Error('Descrição e valor são obrigatórios.')
    let desc = desc0
    if (dados.data) desc += ` [ref. ${String(dados.data).slice(0, 10)}]`
    await insertDroppingUnknown(sb, 'age_gastos', {
      company_id: companyId,
      descricao: desc,
      valor,
      categoria: dados.categoria ? String(dados.categoria).trim() : null,
      tipo: 'real',
    })
    return `Gasto de R$ ${valor.toLocaleString('pt-BR')} registrado.`
  }

  if (action === 'criar_tarefa' || action === 'criar_tarefas' || action === 'atribuir_tarefa') {
    const titles = extractTitles(dados)
    const day = dados.prazo ? String(dados.prazo).slice(0, 10) : todayISO()
    const alvo = String(dados.colaborador_nome || dados.responsavel_nome || '').trim()
    if (action === 'atribuir_tarefa' && alvo) {
      const titulo = titles[0] || String(dados.titulo || '').trim()
      if (!titulo) throw new Error('Título da tarefa é obrigatório.')
      await insertDroppingUnknown(sb, 'age_assigned_tasks', {
        company_id: companyId,
        assigned_to: alvo,
        assigned_by: me,
        title: titulo,
        due_date: day,
        status: 'pendente',
        notes: dados.descricao ? String(dados.descricao).trim() : '',
        deleted: false,
      })
      return `Tarefa "${titulo}" atribuída a ${alvo}.`
    }
    const list = titles.length ? titles : [String(dados.titulo || '').trim()].filter(Boolean)
    if (!list.length) throw new Error('Nenhuma tarefa identificada.')
    for (const text of list) {
      await insertDroppingUnknown(sb, 'age_tasks', {
        company_id: companyId,
        task_text: text,
        day_date: day,
        priority: taskPriority(dados.prioridade),
        done: false,
        owner: me,
        created_by: me,
      })
    }
    return list.length > 1
      ? `${list.length} tarefas criadas para ${day}.`
      : `Tarefa "${list[0]}" criada.`
  }

  if (action === 'criar_pagamento') {
    const nome = String(dados.nome_destinatario || dados.destinatario || '').trim()
    const valor = parseFloat(String(dados.valor))
    if (!nome) throw new Error('Informe para quem é o pagamento.')
    if (!(valor > 0)) throw new Error('Informe o valor do pagamento.')
    const tipo = String(dados.tipo_destinatario || 'fornecedor').toLowerCase()
    const tipoOk = ['fornecedor', 'colaborador', 'cliente', 'outro'].includes(tipo) ? tipo : 'fornecedor'
    const status = String(dados.status || 'pendente').toLowerCase() === 'pago' ? 'pago' : 'pendente'
    const projName = String(dados.projeto_nome || dados.projeto || '').trim()
    let projeto_id: string | null = null
    let projeto_nome: string | null = projName || null
    if (projName && companyId) {
      const p = await findProject(sb, companyId, projName)
      if (p) {
        projeto_id = String(p.id)
        const tit = String(p.project_name || p.title || projName)
        const cli = String(p.client_name || '')
        projeto_nome = cli ? `${cli} — ${tit}` : tit
      }
    }
    await insertDroppingUnknown(sb, 'age_payments', {
      company_id: companyId,
      nome_destinatario: nome,
      tipo_destinatario: tipoOk,
      valor,
      status,
      data_vencimento: dados.data_vencimento ? String(dados.data_vencimento).slice(0, 10) : todayISO(),
      forma_pagamento: String(dados.forma_pagamento || 'pix').toLowerCase(),
      descricao: dados.descricao ? String(dados.descricao).trim() : null,
      projeto_id,
      projeto_nome,
    })
    const brl = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return `Pagamento de ${brl} para ${nome} registrado (${status}).`
  }

  throw new Error(`Ação "${action}" não pode ser executada pelo WhatsApp.`)
}

export async function consultSnapshot(sb: SupabaseClient, companyId: string | null) {
  if (!companyId) return { projetos: [], pagamentos: [] }
  const month = new Date().toISOString().slice(0, 7)
  const [{ data: projetos }, { data: pagamentos }] = await Promise.all([
    sb.from('age_projects')
      .select('project_name, title, client_name, total_value, status, delivery_date')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(8),
    sb.from('age_payments')
      .select('nome_destinatario, valor, status, data_vencimento, projeto_nome')
      .eq('company_id', companyId)
      .gte('data_vencimento', `${month}-01`)
      .limit(12),
  ])
  return { projetos: projetos || [], pagamentos: pagamentos || [] }
}

export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.')
  return createClient(url, key)
}
