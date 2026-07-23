// AGE SOCIALS · Recrutamento — recebe candidatura pública, roda matching
// server-side e dispara análise Claude em background.
//
// Ações:
//   POST { ...payload do form }            → salva candidato + matching + análise
//   POST { action:'analyze', candidate_id } → re-dispara análise Claude (admin)
//
// Secrets necessários: ANTHROPIC_API_KEY (já usado pelo ai-command).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CLAUDE_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_MODEL = Deno.env.get('ANTHROPIC_RECRUIT_MODEL') || 'claude-sonnet-4-5';
const CLAUDE_MODEL_FALLBACKS = [
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-3-5-sonnet-20241022'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

/* ══════════════════════════════════════════════════════════
   ROLES + MATCHING — port 1:1 do roles.js / matching.js do handoff.
   NÃO alterar pesos sem alinhamento (algoritmo calibrado).
══════════════════════════════════════════════════════════ */

const AGE_ROLES = [
  { id: 'social_media', name: 'Social Media',
    keywords: ['conteúdo','feed','post','engajamento','calendário','legenda','trend','reels','instagram','tiktok','linkedin','audiência','métrica','copy','briefing'],
    tools: ['Instagram','TikTok','LinkedIn','Meta Business','Later','Notion','Canva','CapCut','Figma','Trello'],
    styleProfile: { pace: 80, autonomy: 60, structure: 70, creative: 75, social: 85, detail: 65 } },
  { id: 'designer', name: 'Designer',
    keywords: ['design','identidade','tipografia','grid','cor','layout','branding','visual','estética','ilustração','sistema','peça','arte'],
    tools: ['Figma','Adobe Illustrator','Photoshop','InDesign','After Effects','Blender'],
    styleProfile: { pace: 55, autonomy: 75, structure: 80, creative: 95, social: 40, detail: 90 } },
  { id: 'editor_video', name: 'Editor de Vídeo',
    keywords: ['edição','corte','ritmo','transição','color','sound','narrativa','reels','timeline','raw','bruto'],
    tools: ['Premiere','DaVinci Resolve','CapCut','Final Cut','After Effects','Audition'],
    styleProfile: { pace: 70, autonomy: 70, structure: 75, creative: 85, social: 35, detail: 85 } },
  { id: 'filmmaker', name: 'Filmmaker',
    keywords: ['câmera','direção','set','luz','lente','áudio','gravação','diária','filmagem','roteiro','cinematografia'],
    tools: ['Sony','Canon','BlackMagic','DJI','Rode','Premiere','DaVinci Resolve','Iluminação'],
    styleProfile: { pace: 65, autonomy: 80, structure: 65, creative: 90, social: 70, detail: 85 } },
  { id: 'copywriter', name: 'Copywriter',
    keywords: ['copy','texto','headline','roteiro','palavra','escrita','narrativa','briefing','ângulo','insight','manifesto','slogan','ideia'],
    tools: ['Notion','Google Docs','ChatGPT','Claude','Grammarly'],
    styleProfile: { pace: 60, autonomy: 75, structure: 70, creative: 90, social: 55, detail: 80 } },
  { id: 'trafego', name: 'Gestor de Tráfego',
    keywords: ['tráfego','ads','campanha','ctr','cpc','cpa','roas','conversão','pixel','público','lookalike','teste','métrica','funil'],
    tools: ['Meta Ads','Google Ads','TikTok Ads','GA4','Google Tag Manager','Hotjar','Looker'],
    styleProfile: { pace: 75, autonomy: 80, structure: 90, creative: 45, social: 40, detail: 95 } },
  { id: 'atendimento', name: 'Atendimento / CS',
    keywords: ['cliente','reunião','briefing','alinhamento','expectativa','relacionamento','prazo','apresentação','call','follow','ponte'],
    tools: ['Notion','Slack','Google Meet','Loom','Trello','Asana','Pipefy'],
    styleProfile: { pace: 80, autonomy: 70, structure: 85, creative: 50, social: 95, detail: 80 } },
  { id: 'estrategia', name: 'Estratégia / Planejamento',
    keywords: ['estratégia','planejamento','insight','marca','território','pesquisa','benchmark','posicionamento','brief','plano','tese','cultura'],
    tools: ['Notion','Miro','Google Trends','Semrush','Meltwater','Figma','Keynote'],
    styleProfile: { pace: 55, autonomy: 85, structure: 90, creative: 80, social: 70, detail: 85 } },
  { id: 'motion', name: 'Motion Designer',
    keywords: ['motion','animação','keyframe','after effects','ease','timing','transição','loop','render','3d','rig'],
    tools: ['After Effects','Cinema 4D','Blender','Figma','Illustrator','Photoshop','DaVinci'],
    styleProfile: { pace: 60, autonomy: 75, structure: 80, creative: 95, social: 40, detail: 95 } },
  { id: 'community', name: 'Community Manager',
    keywords: ['comunidade','comentário','dm','conversa','sentimento','engajamento','resposta','fã','seguidor','monitorar','crise','moderação'],
    tools: ['Instagram','TikTok','X','Discord','Reddit','Meltwater','Notion','Slack'],
    styleProfile: { pace: 85, autonomy: 65, structure: 60, creative: 65, social: 95, detail: 70 } },
  { id: 'projetos', name: 'Projetos / Operação',
    keywords: ['projeto','operação','processo','workflow','prazo','entrega','checklist','gestão','time','organização','kanban','ritual'],
    tools: ['Notion','Asana','Trello','ClickUp','Monday','Slack','Pipefy'],
    styleProfile: { pace: 75, autonomy: 80, structure: 95, creative: 40, social: 75, detail: 95 } },
  { id: 'comercial', name: 'Comercial',
    keywords: ['comercial','venda','proposta','prospect','negociação','fechar','pitch','reunião','contrato','lead','cliente','cold'],
    tools: ['HubSpot','Pipedrive','RD Station','LinkedIn Sales','Notion','Google Meet','Loom'],
    styleProfile: { pace: 85, autonomy: 85, structure: 75, creative: 55, social: 95, detail: 70 } }
];

const ROUTINE_OPTIONS = [
  { id: 'creative_morning', label: 'Manhã criativa, tarde de execução', roles: ['designer','copywriter','motion','editor_video','estrategia'] },
  { id: 'reactive', label: 'Reagir ao que aparece no dia — dinâmico', roles: ['social_media','community','atendimento','comercial'] },
  { id: 'deep_focus', label: 'Blocos longos de foco profundo', roles: ['designer','editor_video','motion','copywriter','trafego','estrategia'] },
  { id: 'meetings', label: 'Reuniões, calls, alinhamentos o dia todo', roles: ['atendimento','comercial','projetos','estrategia'] },
  { id: 'field', label: 'No campo, gravando, fora do escritório', roles: ['filmmaker','social_media'] },
  { id: 'dashboard', label: 'Olhando painéis, ajustando, otimizando', roles: ['trafego','projetos'] }
];

const DELIVERY_OPTIONS = [
  { id: 'campaign', label: 'Campanha inteira, do brief à entrega', roles: ['estrategia','copywriter','atendimento','projetos'] },
  { id: 'piece', label: 'Peça pontual, focada, com craft', roles: ['designer','motion','editor_video','copywriter'] },
  { id: 'volume', label: 'Volume alto de conteúdo diário', roles: ['social_media','community','editor_video'] },
  { id: 'performance', label: 'Otimização contínua com dado', roles: ['trafego','projetos'] },
  { id: 'people', label: 'Cuidando de gente — cliente ou time', roles: ['atendimento','projetos','comercial','community'] },
  { id: 'production', label: 'Produção em set, câmera, luz', roles: ['filmmaker'] },
  { id: 'newbiz', label: 'Prospecção, pitch, novos negócios', roles: ['comercial'] }
];

const ALGO_VERSION = 'v1.0';

// deno-lint-ignore no-explicit-any
function calculateMatch(answers: any) {
  const roles = AGE_ROLES;
  const scores: Record<string, number> = {};
  roles.forEach(r => scores[r.id] = 0);

  // 1) Áreas de interesse — peso ALTO (35 pts cada)
  (answers.interests || []).forEach((id: string) => {
    if (scores[id] !== undefined) scores[id] += 35;
  });

  // 2) Ferramentas — 5 pts por match
  const tools = (answers.tools || []).map((t: string) => t.toLowerCase());
  roles.forEach(r => {
    r.tools.forEach(t => {
      if (tools.some((userTool: string) => t.toLowerCase().includes(userTool) || userTool.includes(t.toLowerCase()))) {
        scores[r.id] += 5;
      }
    });
  });

  // 3) Texto livre — keywords em campos abertos (2 pts por ocorrência)
  const freeText = [
    answers.proudProject || '', answers.mistake || '',
    answers.culture || '', answers.experience || ''
  ].join(' ').toLowerCase();

  roles.forEach(r => {
    r.keywords.forEach(kw => {
      const regex = new RegExp('\\b' + kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      const matches = freeText.match(regex);
      if (matches) scores[r.id] += matches.length * 2;
    });
  });

  // 4) Estilo — distância euclidiana ao perfil da função (até 25 pts)
  const userStyle = answers.style || {};
  roles.forEach(r => {
    let dist = 0, count = 0;
    (Object.keys(r.styleProfile) as Array<keyof typeof r.styleProfile>).forEach(key => {
      const userVal = userStyle[key] !== undefined ? userStyle[key] : 50;
      const roleVal = r.styleProfile[key];
      dist += Math.pow(userVal - roleVal, 2);
      count++;
    });
    dist = Math.sqrt(dist / count);
    scores[r.id] += Math.max(0, 25 - dist * 0.25);
  });

  // 5) Rotina ideal — +8
  const routine = ROUTINE_OPTIONS.find(o => o.id === answers.routine);
  if (routine) routine.roles.forEach(rid => { if (scores[rid] !== undefined) scores[rid] += 8; });

  // 6) Entrega — +10
  const delivery = DELIVERY_OPTIONS.find(o => o.id === answers.delivery);
  if (delivery) delivery.roles.forEach(rid => { if (scores[rid] !== undefined) scores[rid] += 10; });

  const ranked = roles.map(r => ({ role: r, score: scores[r.id] })).sort((a, b) => b.score - a.score);
  const maxTheoretical = 130;
  const top = ranked[0];
  const topMatchPct = Math.min(99, Math.round((top.score / maxTheoretical) * 100));
  const top3 = ranked.slice(0, 3).map(item => ({
    role_id: item.role.id,
    role_name: item.role.name,
    match_pct: Math.min(99, Math.round((item.score / maxTheoretical) * 100))
  }));

  // Score técnico
  const years = parseFloat(answers.experienceYears) || 0;
  let technical = 0;
  technical += Math.min(30, (answers.tools?.length || 0) * 3);
  technical += Math.min(30, years * 5);
  technical += (answers.portfolio && answers.portfolio.trim().length > 5) ? 20 : 0;
  technical += (answers.linkedin && answers.linkedin.trim().length > 5) ? 10 : 0;
  technical += Math.min(10, top.score / 15);
  technical = Math.round(Math.min(100, technical));

  // Score cultural
  const cultureText = [answers.culture || '', answers.mistake || '', answers.proudProject || ''].join(' ').toLowerCase();
  const POSITIVE = [
    'aprend','errei','erro','time','juntos','colabor','ouvir','escut',
    'humild','referência','estud','evolu','process','feedback','dono',
    'iniciativa','responsáv','entreg','compromiss','craft','detalhe',
    'client','pessoa','gente','crescer','cresci','ajud','apoi',
    'curios','ideia','test','tentei','melhor','improvi','adapt'
  ];
  let cultural = 40;
  POSITIVE.forEach(kw => { if (cultureText.includes(kw)) cultural += 3; });
  const totalLen = cultureText.length;
  if (totalLen > 300) cultural += 15;
  else if (totalLen > 150) cultural += 8;
  else if (totalLen > 50) cultural += 3;
  if (totalLen < 30) cultural = Math.max(20, cultural - 20);
  cultural = Math.round(Math.min(100, cultural));

  const fitScore = Math.round((top.score / maxTheoretical) * 100);
  const overall = Math.round(fitScore * 0.4 + cultural * 0.3 + technical * 0.3);

  let seniority: string;
  if (years < 1) seniority = 'Promissor em desenvolvimento';
  else if (years < 3) seniority = technical >= 70 ? 'Pleno' : 'Júnior';
  else if (years < 6) seniority = technical >= 75 ? 'Sênior' : 'Pleno';
  else seniority = 'Sênior';

  const messages: Record<string, string> = {
    'Promissor em desenvolvimento': 'Energia e vontade são matéria-prima. A gente cuida do resto.',
    'Júnior': 'Base sólida e caminho pela frente. Lugar certo pra crescer rápido.',
    'Pleno': 'Autonomia sem perder o time. Você entra pra entregar de verdade.',
    'Sênior': 'Repertório, direção e voz. Você chega pra puxar a régua.'
  };

  return {
    top_role: { id: top.role.id, name: top.role.name },
    top_match_pct: topMatchPct,
    top3,
    scores: {
      overall: Math.min(99, overall),
      cultural: Math.min(99, cultural),
      technical: Math.min(99, technical)
    },
    seniority,
    message: messages[seniority]
  };
}

/* ══════════════════════════════════════════════════════════
   DB helpers (PostgREST com service role)
══════════════════════════════════════════════════════════ */

async function db(method: string, path: string, body?: unknown) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SB_SERVICE_KEY,
      'Authorization': `Bearer ${SB_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
  if (!res.ok) throw new Error(`DB ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

/* ══════════════════════════════════════════════════════════
   Análise Claude (background)
══════════════════════════════════════════════════════════ */

const ANALYSIS_SYSTEM_PROMPT = `Você é analista de recrutamento sênior da AGE SOCIALS, uma agência de social media que valoriza:
- Craft e obsessão por detalhe
- Repertório cultural e leitura de contexto
- Autonomia com senso de dono
- Humildade e capacidade de errar bem
- Ritmo rápido sem perder qualidade
- Feedback direto e comunicação clara

Sua tarefa é ler as respostas de um candidato e produzir uma análise QUALITATIVA que complemente
o matching quantitativo já calculado.

Você é honesto, direto e específico. Não infla nem suaviza. Se um perfil não serve, você diz.
Se um perfil brilha, você diz o porquê com exemplo concreto tirado da resposta.

IMPORTANTE:
- Responda SEMPRE em JSON válido, seguindo o schema exato pedido pelo usuário.
- Cite trechos literais das respostas quando fizer sentido (em highlights e red_flags).
- Se não tiver evidência pra afirmar algo, use "revisar_manualmente" e explique.
- Todas as respostas em português do Brasil, tom profissional mas humano.`;

// deno-lint-ignore no-explicit-any
function buildAnalysisPrompt(c: any, m: any) {
  const interestNames = (c.interests || [])
    .map((id: string) => AGE_ROLES.find(r => r.id === id)?.name)
    .filter(Boolean).join(', ');
  const routineLabel = ROUTINE_OPTIONS.find(r => r.id === c.routine)?.label || '—';
  const deliveryLabel = DELIVERY_OPTIONS.find(d => d.id === c.delivery)?.label || '—';
  // deno-lint-ignore no-explicit-any
  const top3Names = (m.top3 || []).map((t: any) => `${t.role_name} (${t.match_pct}%)`).join(', ');

  const TECH_LEVEL_LABELS: Record<string, string> = {
    iniciante: 'Iniciante (entrega com ajuda)', intermediario: 'Intermediário (dá conta do dia a dia)',
    avancado: 'Avançado (resolve casos complexos e ajuda o time)', especialista: 'Especialista (referência técnica)'
  };
  const LEARNING_LABELS: Record<string, string> = {
    pratica_rapido: 'Aprende fazendo, rápido', estrutura: 'Prefere material/curso/explicação antes',
    observando: 'Aprende observando quem faz bem', tentativa_erro: 'Tentativa e erro até destravar'
  };
  const MISTAKE_STYLE_LABELS: Record<string, string> = {
    assumo_na_hora: 'Assume na hora e corrige rápido', corrijo_depois_aviso: 'Corrige e depois comunica',
    analiso_antes: 'Analisa a fundo antes de falar', evito_expor: 'Tem dificuldade de expor erros'
  };
  const PAY_DAYRATE_LABELS: Record<string, string> = {
    nao_freela: 'Não trabalha por diária', ate_300: 'Até R$300', '300_500': 'R$300–500',
    '500_800': 'R$500–800', '800_1200': 'R$800–1.200', '1200_2000': 'R$1.200–2.000', acima_2000: 'Acima de R$2.000'
  };
  const PAY_FIXED_LABELS: Record<string, string> = {
    ate_1500: 'Até R$1.500', '1500_2500': 'R$1.500–2.500', '2500_4000': 'R$2.500–4.000',
    '4000_6000': 'R$4.000–6.000', '6000_9000': 'R$6.000–9.000', acima_9000: 'Acima de R$9.000', negociar: 'Aberto a negociar'
  };
  const techLevelLabel = TECH_LEVEL_LABELS[c.tech_level] || '—';
  const learningLabel = LEARNING_LABELS[c.learning_speed] || '—';
  const mistakeStyleLabel = MISTAKE_STYLE_LABELS[c.mistake_style] || '—';
  const dayRateLabel = PAY_DAYRATE_LABELS[c.day_rate_range] || '—';
  const fixedLabel = PAY_FIXED_LABELS[c.fixed_salary_range] || '—';
  const valuesLabel = (c.culture_values || []).join(', ') || '—';

  return `Analise este candidato da AGE SOCIALS.

## MATCHING AUTOMÁTICO (já calculado)
- Função ideal detectada: ${m.top_role_name}
- Match: ${m.top_match_pct}%
- Senioridade sugerida: ${m.seniority}
- Score geral: ${m.score_overall} · Cultural: ${m.score_cultural} · Técnico: ${m.score_technical}
- Top 3: ${top3Names}

## DADOS DO CANDIDATO
- Nome: ${c.name}
- Cidade: ${c.city || '—'}
- Anos de experiência: ${c.experience_years ?? '—'}
- Áreas de interesse marcadas: ${interestNames || '—'}
- Ferramentas: ${(c.tools || []).join(', ') || '—'}
- Nível técnico (autoavaliação): ${techLevelLabel}
- Valores culturais que preza: ${valuesLabel}
- Como aprende algo novo: ${learningLabel}
- Como lida com os próprios erros: ${mistakeStyleLabel}
- Rotina ideal: ${routineLabel}
- Entrega em que rende melhor: ${deliveryLabel}
- Pretensão por diária (freela): ${dayRateLabel}
- Pretensão salário fixo (mensal): ${fixedLabel}

## RESPOSTAS ABERTAS

### Trajetória profissional:
${c.experience_text || '—'}

### O que não pode faltar num lugar pra trabalhar bem:
${c.culture_answer || '—'}

### Projeto de orgulho:
${c.proud_project || '—'}

### Erro que ensinou algo:
${c.mistake || '—'}

---

Devolva JSON no seguinte schema EXATO (nenhum campo a mais, nenhum a menos):

{
  "resumo_perfil": "1-2 frases resumindo o perfil. Direto, sem clichê.",
  "parecer_geral": "recomendado" | "recomendado_com_ressalvas" | "nao_recomendado" | "revisar_manualmente",
  "highlights": ["3-5 pontos fortes específicos, cada um citando evidência da resposta"],
  "red_flags": ["0-3 pontos de atenção (se houver, com evidência)"],
  "perguntas_entrevista": ["3-5 perguntas para aprofundar em entrevista, específicas ao candidato"],
  "adequacao_cultural": 0-100,
  "confidence": 0-100
}

Nada além do JSON. Nada de markdown, nada de texto antes ou depois.`;
}

async function callClaude(userPrompt: string) {
  const models = [CLAUDE_MODEL, ...CLAUDE_MODEL_FALLBACKS.filter(m => m !== CLAUDE_MODEL)];
  let lastErr = '';
  for (const model of models) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (res.ok) return await res.json();
    lastErr = `${res.status}: ${(await res.text()).slice(0, 300)}`;
    // 404 = modelo não existe → tenta o próximo; outros erros abortam
    if (res.status !== 404) break;
  }
  throw new Error(`Claude API falhou (${lastErr})`);
}

// deno-lint-ignore no-explicit-any
async function runAnalysis(candidateId: string, candidate: any, match: any) {
  // Reaproveita registro pending existente ou cria um
  let analysisId: string | null = null;
  try {
    // deno-lint-ignore no-explicit-any
    const existing = await db('GET', `age_ai_analysis?candidate_id=eq.${candidateId}&select=id&limit=1`) as any[];
    if (existing && existing.length) analysisId = existing[0].id;
  } catch (_) { /* segue */ }

  try {
    if (analysisId) {
      await db('PATCH', `age_ai_analysis?id=eq.${analysisId}`, { status: 'processing', error_message: null });
    } else {
      // deno-lint-ignore no-explicit-any
      const created = await db('POST', 'age_ai_analysis', { candidate_id: candidateId, status: 'processing' }) as any[];
      analysisId = created?.[0]?.id || null;
    }

    const response = await callClaude(buildAnalysisPrompt(candidate, match));
    // deno-lint-ignore no-explicit-any
    const rawText = (response.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const clampInt = (v: unknown) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
    };
    const strArr = (v: unknown) => Array.isArray(v) ? v.map(x => String(x)).slice(0, 8) : [];
    const PARECERES = ['recomendado', 'recomendado_com_ressalvas', 'nao_recomendado', 'revisar_manualmente'];

    await db('PATCH', `age_ai_analysis?id=eq.${analysisId}`, {
      status: 'completed',
      resumo_perfil: String(parsed.resumo_perfil || ''),
      parecer_geral: PARECERES.includes(parsed.parecer_geral) ? parsed.parecer_geral : 'revisar_manualmente',
      highlights: strArr(parsed.highlights),
      red_flags: strArr(parsed.red_flags),
      perguntas_entrevista: strArr(parsed.perguntas_entrevista),
      adequacao_cultural: clampInt(parsed.adequacao_cultural),
      confidence: clampInt(parsed.confidence),
      model_used: response.model || CLAUDE_MODEL,
      tokens_input: response.usage?.input_tokens || null,
      tokens_output: response.usage?.output_tokens || null,
      raw_response: parsed
    });
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 500);
    try {
      if (analysisId) {
        await db('PATCH', `age_ai_analysis?id=eq.${analysisId}`, { status: 'failed', error_message: msg });
      } else {
        await db('POST', 'age_ai_analysis', { candidate_id: candidateId, status: 'failed', error_message: msg });
      }
    } catch (_) { /* último recurso: só loga */ }
    console.error('[recruit-analysis]', msg);
  }
}

/* ══════════════════════════════════════════════════════════
   Handler
══════════════════════════════════════════════════════════ */

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonRes(405, { error: 'method_not_allowed', code: 'method_not_allowed' });

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch (_) {
    return jsonRes(400, { error: 'JSON inválido', code: 'validation_error' });
  }

  /* ── Ação admin: re-disparar análise ── */
  if (payload.action === 'analyze') {
    const cid = String(payload.candidate_id || '').trim();
    if (!cid) return jsonRes(400, { error: 'candidate_id obrigatório', code: 'validation_error' });
    // deno-lint-ignore no-explicit-any
    const rows = await db('GET', `age_candidates?id=eq.${cid}&limit=1`) as any[];
    if (!rows || !rows.length) return jsonRes(404, { error: 'Candidato não encontrado', code: 'not_found' });
    // deno-lint-ignore no-explicit-any
    const matches = await db('GET', `age_match_results?candidate_id=eq.${cid}&order=created_at.desc&limit=1`) as any[];
    const m = matches?.[0] || {};
    const bg = runAnalysis(cid, rows[0], m);
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(bg); else await bg;
    return jsonRes(202, { candidate_id: cid, status: 'processing' });
  }

  /* ── Submissão pública ── */
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  if (!name || name.length < 2) return jsonRes(400, { error: 'Nome obrigatório', code: 'validation_error' });
  if (!email || !email.includes('@') || email.length > 200) return jsonRes(400, { error: 'Email inválido', code: 'validation_error' });
  if (!payload.consent_lgpd) return jsonRes(400, { error: 'Consentimento LGPD obrigatório', code: 'validation_error' });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const ua = (req.headers.get('user-agent') || '').slice(0, 400) || null;

  const cutIso = (min: number) => new Date(Date.now() - min * 60000).toISOString();

  // Idempotência: mesmo email em <5min → retorna o existente
  try {
    const dup = await db('GET',
      `age_candidates?email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(cutIso(5))}&select=id&limit=1`
      // deno-lint-ignore no-explicit-any
    ) as any[];
    if (dup && dup.length) {
      // deno-lint-ignore no-explicit-any
      const m = (await db('GET', `age_match_results?candidate_id=eq.${dup[0].id}&limit=1`) as any[])?.[0];
      return jsonRes(201, {
        candidate_id: dup[0].id,
        duplicate: true,
        match: m ? {
          top_role: { id: m.top_role_id, name: m.top_role_name },
          top_match_pct: m.top_match_pct, top3: m.top3,
          scores: { overall: m.score_overall, cultural: m.score_cultural, technical: m.score_technical },
          seniority: m.seniority
        } : null
      });
    }
  } catch (_) { /* segue o fluxo normal */ }

  // Rate limit: máx 5 submissões por IP a cada 10 min
  if (ip) {
    try {
      const recent = await db('GET',
        `age_candidates?ip_address=eq.${encodeURIComponent(ip)}&created_at=gte.${encodeURIComponent(cutIso(10))}&select=id&limit=6`
        // deno-lint-ignore no-explicit-any
      ) as any[];
      if (recent && recent.length >= 5) {
        return jsonRes(429, { error: 'Muitas submissões. Tente novamente em alguns minutos.', code: 'rate_limited' });
      }
    } catch (_) { /* rate limit é best effort */ }
  }

  const clampTxt = (v: unknown, max: number) => v == null ? null : String(v).slice(0, max);
  const strArrIn = (v: unknown, max: number) => Array.isArray(v) ? v.map(x => String(x).slice(0, 80)).slice(0, max) : [];

  const candidateRow = {
    name: name.slice(0, 160),
    email,
    city: clampTxt(payload.city, 120),
    linkedin_url: clampTxt(payload.linkedin_url, 300),
    portfolio_url: clampTxt(payload.portfolio_url, 300),
    experience_years: payload.experience_years != null ? parseFloat(String(payload.experience_years)) || null : null,
    experience_text: clampTxt(payload.experience_text, 4000),
    interests: strArrIn(payload.interests, 12),
    tools: strArrIn(payload.tools, 40),
    tech_level: clampTxt(payload.tech_level, 40),
    style_profile: (payload.style_profile && typeof payload.style_profile === 'object') ? payload.style_profile : {},
    culture_values: strArrIn(payload.culture_values, 20),
    culture_answer: clampTxt(payload.culture_answer, 4000),
    learning_speed: clampTxt(payload.learning_speed, 40),
    mistake_style: clampTxt(payload.mistake_style, 40),
    proud_project: clampTxt(payload.proud_project, 4000),
    mistake: clampTxt(payload.mistake, 4000),
    routine: clampTxt(payload.routine, 60),
    delivery: clampTxt(payload.delivery, 60),
    day_rate_range: clampTxt(payload.day_rate_range, 40),
    fixed_salary_range: clampTxt(payload.fixed_salary_range, 40),
    ref_source: clampTxt(payload.ref_source, 120),
    ip_address: ip,
    user_agent: ua,
    consent_lgpd: true,
    status: 'novo'
  };

  let candidateId: string;
  try {
    // deno-lint-ignore no-explicit-any
    const inserted = await db('POST', 'age_candidates', candidateRow) as any[];
    candidateId = inserted?.[0]?.id;
    if (!candidateId) throw new Error('Insert sem id');
  } catch (e) {
    console.error('[recruit-submit] insert', e);
    return jsonRes(500, { error: 'Erro ao salvar candidatura', code: 'insert_failed' });
  }

  // Matching server-side (fonte da verdade pro admin)
  const match = calculateMatch({
    interests: candidateRow.interests,
    tools: candidateRow.tools,
    proudProject: candidateRow.proud_project,
    mistake: candidateRow.mistake,
    culture: candidateRow.culture_answer,
    experience: candidateRow.experience_text,
    style: candidateRow.style_profile,
    routine: candidateRow.routine,
    delivery: candidateRow.delivery,
    experienceYears: candidateRow.experience_years,
    portfolio: candidateRow.portfolio_url,
    linkedin: candidateRow.linkedin_url
  });

  const matchRow = {
    candidate_id: candidateId,
    top_role_id: match.top_role.id,
    top_role_name: match.top_role.name,
    top_match_pct: match.top_match_pct,
    top3: match.top3,
    score_overall: match.scores.overall,
    score_cultural: match.scores.cultural,
    score_technical: match.scores.technical,
    seniority: match.seniority,
    algo_version: ALGO_VERSION
  };
  try { await db('POST', 'age_match_results', matchRow); }
  catch (e) { console.error('[recruit-submit] match insert', e); }

  // Análise Claude em background — nunca bloqueia o response
  const bg = runAnalysis(candidateId, candidateRow, matchRow);
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(bg);
  else bg.catch(() => {});

  return jsonRes(201, { candidate_id: candidateId, match });
});
