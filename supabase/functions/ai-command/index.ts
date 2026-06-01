import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
/* Haiku 4.5 — ID oficial Anthropic (maio/2026). Override: secret ANTHROPIC_MODEL */
const CLAUDE_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-haiku-4-5-20251001';
const CLAUDE_MODEL_FALLBACKS = [
  'claude-haiku-4-5-20251001',
  'claude-haiku-4-5',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const SYSTEM_PROMPT = `Você é o assistente de comando do Age Ops,
um sistema de gestão para produtoras audiovisuais brasileiras.

Quando o usuário digitar um comando em linguagem natural, você deve:
1. Identificar a INTENÇÃO do usuário
2. Extrair os DADOS mencionados
3. Retornar um JSON estruturado com a ação e os dados

AÇÕES DISPONÍVEIS:
- criar_projeto
- criar_cliente
- criar_orcamento
- criar_evento     (compromisso/evento no calendário; pode ser atribuído a um colaborador)
- criar_gasto
- criar_tarefa     (uma única tarefa)
- criar_tarefas    (várias tarefas pessoais de uma vez; use quando o usuário listar itens separados por vírgula)
- atribuir_tarefa  (atribuir uma tarefa diretamente a um colaborador)
- consultar
- desconhecido

FORMATO DE RESPOSTA (sempre JSON válido, sem markdown):

Para criar_projeto:
{
  "acao": "criar_projeto",
  "confirmacao": "Criar projeto [nome] para [cliente] no valor de [valor]?",
  "dados": {
    "nome": "string",
    "cliente_nome": "string ou null",
    "valor_total": number ou null,
    "data_entrega": "YYYY-MM-DD ou null",
    "status": "em_producao",
    "descricao": "string ou null"
  }
}

Para criar_cliente:
{
  "acao": "criar_cliente",
  "confirmacao": "Adicionar cliente [nome]?",
  "dados": {
    "nome": "string",
    "contato": "string ou null",
    "email": "string ou null",
    "telefone": "string ou null",
    "empresa": "string ou null"
  }
}

Para criar_orcamento:
{
  "acao": "criar_orcamento",
  "confirmacao": "Criar orçamento de [valor] para [cliente]?",
  "dados": {
    "titulo": "string",
    "cliente_nome": "string ou null",
    "valor_total": number ou null,
    "validade_dias": number ou 15,
    "descricao": "string ou null"
  }
}

Para criar_evento:
{
  "acao": "criar_evento",
  "confirmacao": "Marcar [titulo] no dia [data] às [hora] (para [colaborador])?",
  "dados": {
    "titulo": "string",
    "data_inicio": "YYYY-MM-DD",
    "data_fim": "YYYY-MM-DD ou null (preencha em eventos de vários dias, ex.: 'de 29 a 30 de junho')",
    "hora_inicio": "HH:MM:00 ou null",
    "hora_fim": "HH:MM:00 ou null",
    "tipo": "projeto|reuniao|gravacao|entrega|prazo|edicao|deslocamento|outro",
    "colaborador_nome": "string ou null (nome do colaborador a quem o compromisso é atribuído)",
    "responsavel_nome": "string ou null (igual a colaborador_nome quando houver)",
    "descricao": "string ou null"
  }
}

Para criar_gasto:
{
  "acao": "criar_gasto",
  "confirmacao": "Registrar gasto de [valor] em [categoria]?",
  "dados": {
    "descricao": "string",
    "valor": number,
    "categoria": "string ou null",
    "data": "YYYY-MM-DD"
  }
}

Para criar_tarefa (apenas UMA tarefa):
{
  "acao": "criar_tarefa",
  "confirmacao": "Criar tarefa [titulo] para [dia]?",
  "dados": {
    "titulo": "string",
    "descricao": "string ou null",
    "colaborador_nome": "string ou null (preencha quando a tarefa for para outra pessoa)",
    "responsavel_nome": "string ou null",
    "prazo": "YYYY-MM-DD ou null",
    "prioridade": "alta|media|baixa"
  }
}

Para criar_tarefas (VÁRIAS tarefas pessoais — lista separada por vírgula, "para mim", "meu pessoal"):
{
  "acao": "criar_tarefas",
  "confirmacao": "Criar [N] tarefas pessoais para [dia]?",
  "dados": {
    "tarefas": ["string", "string", "..."],
    "prazo": "YYYY-MM-DD ou null",
    "prioridade": "alta|media|baixa",
    "pessoal": true
  }
}

Para atribuir_tarefa (use quando o comando designar/atribuir uma tarefa a um colaborador):
{
  "acao": "atribuir_tarefa",
  "confirmacao": "Atribuir tarefa [titulo] a [colaborador] para [dia]?",
  "dados": {
    "titulo": "string",
    "descricao": "string ou null",
    "colaborador_nome": "string (nome do colaborador alvo)",
    "prazo": "YYYY-MM-DD ou null",
    "prioridade": "alta|media|baixa"
  }
}

Para consultar:
{
  "acao": "consultar",
  "resposta": "Resposta em português brasileiro clara e direta"
}

Para desconhecido:
{
  "acao": "desconhecido",
  "resposta": "Não entendi. Tente: 'Novo projeto Nike R$50k prazo junho'"
}

REGRAS:
- Sempre responda em português brasileiro
- Datas relativas: 'sexta' = próxima sexta, 'amanhã' = dia seguinte. Use contexto.data_iso como hoje.
- "dia 05" / "dia 5" sem mês = dia 05 do mês atual (contexto.mes/contexto.ano)
- Intervalos ("de 29 a 30 de junho", "dia 29 e 30") → data_inicio = primeiro dia, data_fim = último dia
- Valores: '50k' = 50000, 'R$1.200' = 1200
- ATRIBUIÇÃO A COLABORADORES: o contexto traz "colaboradores" (lista de nomes da empresa).
  Quando o comando disser "para [Fulano]", "designe para [Fulano]", "atribua a [Fulano]",
  use o nome exatamente como aparece na lista de colaboradores em colaborador_nome.
- Se o comando é um COMPROMISSO/EVENTO com data e horário (gravação, reunião, entrega) e
  menciona um colaborador, use criar_evento com colaborador_nome (ele aparece no calendário dele).
- Se o comando é uma TAREFA a ser feita por um colaborador, use atribuir_tarefa.
- LISTA DE TAREFAS PESSOAIS: se o usuário pedir várias tarefas para si ("para mim", "meu pessoal", "minhas tarefas")
  e separar itens por vírgula, use criar_tarefas com array "tarefas" (um item por tarefa, texto curto).
  NÃO coloque colaborador_nome em criar_tarefas. Nomes citados no texto da tarefa (Gabriel, Victoria…) são contexto, não destinatário.
- "amanhã" → prazo = dia seguinte a contexto.data_iso
- Retorne APENAS o JSON, sem markdown
- Se faltar informação importante, use null`;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function stripMarkdownJson(raw: string) {
  let t = String(raw || '').trim();
  if(t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return t;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ acao: 'erro', resposta: 'Método não permitido.' }, 405);
  }

  if (!CLAUDE_API_KEY || !String(CLAUDE_API_KEY).trim()) {
    return jsonResponse({
      acao: 'erro',
      resposta: 'ANTHROPIC_API_KEY não configurada no Supabase. Vá em Project Settings → Edge Functions → Secrets e adicione ANTHROPIC_API_KEY com sua chave da Anthropic, depois rode: supabase functions deploy ai-command'
    });
  }

  try {
    let body: { comando?: string; contexto?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ acao: 'erro', resposta: 'Corpo da requisição inválido (JSON esperado).' });
    }

    const comando = String(body?.comando || '').trim();
    if (!comando) {
      return jsonResponse({ acao: 'erro', resposta: 'Digite um comando para o assistente.' });
    }

    const contexto = body?.contexto ?? {};

    const modelsToTry = [
      CLAUDE_MODEL,
      ...CLAUDE_MODEL_FALLBACKS.filter((m) => m !== CLAUDE_MODEL)
    ];

    let response: Response | null = null;
    let claudeData: Record<string, unknown> = {};
    let modelUsed = modelsToTry[0];
    let lastErrMsg = '';

    for (const modelId of modelsToTry) {
      modelUsed = modelId;
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Contexto atual: ${JSON.stringify(contexto)}\n\nComando: "${comando}"`
          }]
        })
      });

      try {
        claudeData = await response.json();
      } catch {
        return jsonResponse({
          acao: 'erro',
          resposta: `Resposta inválida da Anthropic (HTTP ${response.status}).`
        });
      }

      if (response.ok) break;

      const errObj = claudeData?.error as { message?: string; type?: string } | undefined;
      lastErrMsg = errObj?.message
        || String(claudeData?.message || '')
        || `HTTP ${response.status}`;
      const isModelErr = /model/i.test(lastErrMsg) || errObj?.type === 'not_found_error';
      console.warn('[ai-command] model failed:', modelId, lastErrMsg);
      if (!isModelErr) break;
    }

    if (!response || !response.ok) {
      console.error('[ai-command] Anthropic error:', claudeData);
      return jsonResponse({
        acao: 'erro',
        resposta: `IA indisponível: ${lastErrMsg}. Modelo tentado: ${modelUsed}. Use ANTHROPIC_MODEL=claude-haiku-4-5-20251001 no Supabase Secrets.`
      });
    }

    const content = claudeData?.content as Array<{ type?: string; text?: string }> | undefined;
    const texto = content?.find((b) => b?.type === 'text')?.text
      || content?.[0]?.text
      || '';

    if (!texto) {
      console.error('[ai-command] empty content:', claudeData);
      return jsonResponse({
        acao: 'erro',
        resposta: 'A IA não retornou texto. Tente um comando mais curto.'
      });
    }

    const cleaned = stripMarkdownJson(texto);
    let resultado: Record<string, unknown>;
    try {
      resultado = JSON.parse(cleaned);
    } catch {
      resultado = { acao: 'desconhecido', resposta: cleaned };
    }

    return jsonResponse(resultado);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai-command] unhandled:', err);
    return jsonResponse({
      acao: 'erro',
      resposta: `Erro interno: ${msg}`
    });
  }
});
