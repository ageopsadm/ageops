# AGE OPS — Operating System v4.0

Sistema operacional web completo para a AGE (produtora/agência audiovisual). Integrado com banco de dados histórico de **122 projetos** e **73 clientes** extraídos diretamente das planilhas 2021–2026.

---

## 📊 Dados Históricos (Planilhas Importadas)

| Ano   | Projetos | Faturamento | Custo      | Lucro      | Margem  |
|-------|----------|-------------|------------|------------|---------|
| 2021  | 12       | R$67.415    | R$0 *      | R$67.415   | N/D     |
| 2022  | 25       | R$109.042   | R$58.835   | R$50.207   | 46.1%   |
| 2023  | 28       | R$210.591 ★ | R$97.431   | R$113.160  | 53.7%   |
| 2024  | 22       | R$162.440   | R$77.538   | R$84.902   | 52.3%   |
| 2025  | 23       | R$110.190   | R$0 *      | R$110.190  | N/D     |
| 2026  | 17 (Q1-Q2*)| R$52.550  | R$22.479   | R$30.071   | 57.2%   |
| **Total** | **122** | **R$705.878** | **R$253.783** | **R$452.095** | **64.1%** |

> * 2021 e 2025: planilhas sem coluna de custos preenchida  
> * 2026 Q1-Q2: 15 projetos realizados (Jan–Abr) + 2 projetos futuros Cobertec (Mai e Jun) com contrato trimestral assinado

**Top 5 Clientes:**
1. JAY P — R$243.600 (27 projetos, 2022–2025)
2. UNIVERSAL MUSIC — R$105.100 (5 projetos)
3. Giana Mello — R$96.100 (12 projetos)
4. LOU GARCIA — R$86.900 (4 projetos)
5. KG NETWORK — R$69.550 (6 projetos)

---

## ✅ Funcionalidades Implementadas

### Operações
- **Dashboard** (`#dashboard`) — KPIs em tempo real + banner histórico 2021–2026 + gráfico de evolução anual + top 5 clientes históricos + diagnóstico estratégico com 12 indicadores + score operacional
- **Projetos** (`#projects`) — CRUD completo, edição inline com sync ao vivo, filtros, exportação CSV; painel KPI 2026 integrado ao Dashboard (mini bar chart mensal, indicador LIVE, botão Sync)
- **Fechamento** (`#fechamento`) — Gestão de fechamentos financeiros com gastos detalhados

### Histórico & Clientes
- **Histórico** (`#historico`) — Dashboard por ano (2021–2026) com KPIs, gráficos, ranking, segmentos e contexto textual de cada ano. Relatório geral com CAGR, comparativo, diagnóstico estratégico de 9 pontos
- **Clientes** (`#clientes`) — 73 clientes importados, 7 métricas em cards, filtros por status, histórico por cliente com tabela detalhada

### Equipe
- **Colaboradores** (`#colaboradores`) — Cadastro completo com **função, especialidades, nível de experiência, contato (WhatsApp/Instagram/e-mail), diária, equipamentos, portfólio, avaliação interna, tags e observações**. Banco resetado e schema atualizado. Filtros por função e disponibilidade.
- **Cronograma** (`#cronograma`) — Cronograma semanal com integração ao Meu Dia

### NPS — Avaliação Anônima *(NOVO)*
- **Aba NPS** (`#nps`) no menu CORPORATIVO — Painel com score NPS, nota média, promotores/neutros/detratores, insights e destaques de comentários
- **Gerador de links anônimos** — Cria um link único por etapa do projeto (pós-briefing, pós-gravação, pós-entrega, etc.) com identificação interna visível só para a equipe
- **Página pública** (`nps.html?t=TOKEN`) — Formulário de avaliação em 4 etapas: nota 0–10, sub-notas por estrelas (comunicação, qualidade, prazo, experiência), comentários livres e indicação. **100% anônimo — nenhum dado de projeto, cliente ou nome é coletado ou vinculado**
- **Sigilo garantido**: o cliente não sabe qual projeto está avaliando; a equipe vê apenas nota + etapa + comentário, sem identificação do respondente

### Pessoal
- **Meu Dia** (`#myday`) — Sistema de dias e foco pessoal com XP
- **Minhas Tarefas** (`#mytasks`) — Gestão de tarefas com progresso
- **Financeiro Pessoal** (`#myfinance`) — Lançamentos financeiros pessoais

### Gestão de Projetos
- **Kanban / Gestão** (`#gestao`) — Pipeline de 6 etapas (Reunião → Orçamento Aprovado → Produção → Gravação → Finalização → No Ar), cards arrastáveis, integração com planilha 2026

### Orçamentos
- **Orçamentos** (`#orcamentos`) — Formulário completo com catálogo de serviços (ORC_PACKAGES), descontos, impostos, condições de pagamento, geração de **PDF com download automático** no layout Age Socials (fundo escuro, verde, minimalista), histórico com KPIs e controle de status (Rascunho → Enviado → Aprovado → Recusado)
- **Calculadora de Viabilidade** (painel interno no modal, não vai ao PDF) — Equipe base automática ao adicionar pacotes, adicionar profissionais avulsos com diária configurável, outros custos operacionais, resultado de lucro/margem em tempo real, alerta de viabilidade (✅ Excelente / ⚠️ Razoável / 🚨 Baixa / ❌ Inviável), calculadora de negociação de diárias (máximo por profissional para atingir margem alvo)
- **Pacotes disponíveis** — Videoclipe R$8k (dir + DFoto + prod + op cam + editor), Vídeo Institucional R$8k (mesma equipe), Vídeo Simples R$3,5k (op cam + prod + editor), Visita Horizontal R$5k, Podcast R$3,5k, Evento Completo R$7k, Evento Básico R$3,5k, Content Day R$4,5k, Social Media R$5,5k, Serviço Customizado + adicionais (fotógrafo, drone, equipamento alugado, dias extras)

---

## 🗄️ Banco de Dados

### Tabelas Principais
| Tabela | Registros | Descrição |
|--------|-----------|-----------|
| `age_hist_projects` | 122 | Projetos históricos 2021–2026 das planilhas |
| `age_clients_db` | 73 | Clientes únicos com métricas históricas |
| `age_projects` | variável | Projetos ativos cadastrados manualmente |
| `age_project_stages` | variável | Cards do Kanban |
| `age_colaboradores` | variável | Colaboradores/freelancers com função, especialidade, nível, contato |
| `age_nps_campanhas` | variável | Links NPS gerados por etapa |
| `age_nps_respostas` | variável | Respostas anônimas dos clientes |
| `age_team_members` | legacy | Membros da equipe (legado) |
| `age_leads` | variável | Leads do pipeline comercial |
| `age_tasks` | variável | Tarefas pessoais |
| `age_finance` | variável | Financeiro pessoal |
| `age_fechamento` | variável | Fechamentos de projetos |

### Campos `age_hist_projects`
`id, year, client_name, project_name, sale_date, payment_date, month, is_new_client, value, cost, profit, margin_pct, nps, category, segment, status`

---

## 🚪 URIs e Navegação

| Rota (hash) | Módulo JS | Descrição |
|-------------|-----------|-----------|
| `#dashboard` | `os-app.js` | Painel principal |
| `#projects` | `os-app.js` | Tabela de projetos |
| `#historico` | `os-historico.js` | Banco histórico 2021–2026 |
| `#clientes` | `os-clientes.js` | Banco de clientes |
| `#colaboradores` | `os-team.js` | Membros da equipe |
| `#team-calendar` | `os-team.js` | Calendário da equipe |
| `#gestao` | `os-gestao.js` | Kanban de projetos |
| `#fechamento` | `os-app.js` | Fechamento financeiro |
| `#cronograma` | `os-schedule.js` | Cronograma semanal |
| `#myday` | `os-app.js` | Meu Dia |
| `#mytasks` | `os-app.js` | Minhas Tarefas |
| `#myfinance` | `os-app.js` | Financeiro pessoal |
| `#pipeline` | Pipeline comercial Kanban | Leads → Proposta → Negociação → Fechado |
| `#nps` | NPS | Gerenciamento de campanhas de avaliação |
| `nps.html?t=TOKEN` | Público | Página de avaliação anônima para o cliente |

### Correções de Dados
- **Casa 46 e Escola de Planejados**: empresas do cliente **Jonas** — tratadas como conta estratégica, sem qualquer associação com a Ecologyk
- **Ecologyk**: cliente totalmente separado, projeto de clipe independente (margem zero em 2026)
- **Cobertec e Solutec**: contrato trimestral ativo — R$3k/mês (Março pago + Maio + Junho agendados). Projetos futuros marcados com badge "FUT" na tabela de projetos.

### Correções de Bugs (27/04/2026)
- **Salvamento de projetos**: corrigido bug onde `purgeProjectsNotInSheet()` (botão Sync) sobrescrevia `category`, `segment`, `payment_date`, `total_value` editados pelo usuário. Agora todos os campos editados são preservados no Sync.
- **Auto-login Preview**: corrigido — `index.html` passa `?_al=1` na URL para garantir detecção do ambiente preview. Auto-login usa `_applyLoginSession()` para consistência com o login normal.

---

## 👥 Usuários do Sistema

| Usuário | Senha | Papel |
|---------|-------|-------|
| gustavowng | age2024 | Admin |
| vraulin | age2024 | Admin |
| paulin | age123 | Equipe |
| ken | age123 | Equipe |
| vic | age123 | Equipe |

---

## 📁 Estrutura de Arquivos

```
app.html          — App principal (HTML + estrutura das páginas)
index.html        — Redirect para app.html
css/
  os.css          — Estilos principais (94kb)
js/
  os-auth.js      — Autenticação e usuários
  os-app.js       — App principal: Dashboard, Projetos, Fechamento, etc.
  os-historico.js — Módulo HIST: banco histórico 2021–2026
  os-clientes.js  — Módulo CLIENTS: banco de clientes
  os-team.js      — Módulo TEAM + TEAMCAL: colaboradores e calendário
  os-gestao.js    — Módulo GESTAO: Kanban
  os-schedule.js  — Módulo SCHED: cronograma legado
  os-theme.js     — Seletor de temas
  os-game.js      — Sistema de gamificação (XP)
data/             — Arquivos de importação das planilhas (XLSX → DB)
```

---

## 🔄 Atualizações Recentes — Abr/2026

### 30/04/2026 — Redesign Completo do Modal de Orçamentos

**Objetivo:** Tornar o gerador de orçamentos mais prático e fácil de editar qualquer informação do projeto.

#### Novo Layout — 3 Colunas Fixas
O modal passou de 2 colunas (catálogo + detalhes) para **3 colunas fixas** que ocupam toda a altura da tela:

| Coluna | Largura | Conteúdo |
|--------|---------|----------|
| Catálogo | 270px | Tabs de categoria + lista de pacotes scrollável + botão linha avulsa |
| Escopo | flex (1fr) | Todos os itens adicionados, editáveis inline |
| Projeto + Financeiro | 300px | Datas, pagamento, descontos, impostos, resumo sempre visível |

#### Melhorias no Header
- **Cliente e Projeto ficam no header** — editáveis o tempo todo sem precisar rolar
- Header compacto (12px de padding) para maximizar área útil
- Botão fechar com hover vermelho para evitar fechamento acidental

#### Melhorias nos Cards de Serviço (Col. Central)
- Nome com underline sutil ao focar — editável inline
- Descrição editável com placeholder em cinza claro
- Preço em destaque azul (R$ + input numérico) com feedback visual no foco
- Quantidade > 1 mostra `× N = Total` com input editável
- **Equipe sempre visível** (sem toggle/colapsável) como chips compactos
- Cada membro da equipe tem **input de dias individual** editável diretamente no chip
- Input de dias globais do item propaga para toda a equipe
- Badge de câmera exibido ao lado do label "Equipe"
- Itens sem equipe mostram badges de câmera/dias inline
- Contador de itens no header da coluna (`N itens`)
- Hover com borda azul e sombra sutil

#### Melhorias na Sidebar Direita (Col. Financeiro)
- Datas e pagamento compactos em grid 2 colunas
- Campos com fundo cinza que ficam brancos no foco
- **Resumo financeiro** em card escuro sempre visível — sem precisar rolar para ver o total
- Linhas de desconto e imposto com opacidade reduzida quando zeradas
- Calculadora de viabilidade mantida colapsável na mesma coluna
- Observações no rodapé com flex crescente

#### Novas Funções JS
- `orcUpdateHeaderInfo()` — atualiza o título do modal conforme o cliente digitado
- Variável `orcItemCount` — contador de itens no header do escopo
- `metaBadges` — badges de câmera/dias para itens sem equipe

---

### 18/04/2026 — Integração Total Projetos ↔ Dashboard 2026

**Melhorias implementadas:**
- **Página de Projetos** completamente integrada ao Dashboard: qualquer alteração (salvar, editar inline, excluir) recarrega o Dashboard imediatamente, independente de estar na aba ativa
- **Painel 2026** no topo da página de projetos: KPIs em tempo real (faturamento, custo, lucro, margem, NPS, novos clientes, ticket médio) + mini bar chart de faturamento mensal com dados da planilha como fallback
- **Tabela de projetos** reorganizada conforme planilha 2026: coluna DATA de pagamento primeiro, seguida de CLIENTE, PROJETO, SEGMENTO, VALOR, CUSTO, LUCRO%, NPS, STATUS, NOVO?
- **Ordenação padrão** por `payment_date DESC` (mais recente no topo, conforme planilha 2026)
- **Ícones de sort** dinâmicos indicando direção e campo ativo
- **Segmento** preenchido automaticamente via mapa da planilha 2026 como fallback
- **Custo real** exibido com indicador ✓ quando vem do Fechamento (via SYNC)
- **Exportação CSV** incluindo coluna Segmento e ordenada por data
- **SYNC bidirecional** no `os-sync.js`: eventos `fechamento:saved`, `project:updated`, `kanban:stage_changed` e `historico:updated` agora propagam para AMBAS as páginas
- **Botão Sync manual** no cabeçalho de Projetos para forçar sincronização imediata

### 18/04/2026 — Correção de Duplicatas + Integração Histórico ↔ Dashboard ↔ Clientes

**Problema identificado e corrigido:**
- O banco `age_hist_projects` continha **234 registros duplicados** (deveria ter 122)
- Os totais de faturamento por ano estavam inflados (ex: 2021 aparecia como R$134k em vez de R$67k)
- A contagem de projetos por cliente na aba Clientes estava errada
- Os KPIs do Dashboard podiam ser alimentados com dados duplicados

**Correções implementadas:**

1. **`data/fix_master.html`** — Nova ferramenta de limpeza e reimportação com:
   - **122 projetos hardcoded** das planilhas (fonte verdade garantida)
   - Limpeza completa de `age_hist_projects` + reimportação correta
   - Reconstrução automática de `age_clients_db` com dados corretos
   - Validação por ano antes de inserir

2. **`data/validar_final.html`** — Ferramenta de auditoria que verifica:
   - Contagem de projetos por ano vs. esperado
   - Faturamentos e custos vs. planilhas
   - Top clientes com comparativo

3. **`js/os-historico.js`** — Deduplicação automática ao carregar:
   - Filtra projetos duplicados por `(year + client_name + project_name)`
   - **YEAR_SUMMARY sempre é a fonte verdade** para totais financeiros
   - Tabs de ano usam valores fixos das planilhas, nunca dados inflados do banco
   - `renderYearDashboard`: totais `totalRev`, `totalCost`, `totalPro` vêm de `YEAR_SUMMARY`

4. **`js/os-clientes.js`** — Fonte primária corrigida:
   - `syncClientsFromHistory()` agora **sempre sobrepõe** dados do `age_clients_db` com dados do `age_hist_projects`
   - Projetos exibidos nos cards de clientes vêm do histórico (`_hist_count`)
   - Clientes existentes apenas no histórico (não em `age_clients_db`) são adicionados virtualmente
   - Faturamento e NPS sempre calculados do histórico

5. **`js/os-app.js`** — Deduplicação no Dashboard:
   - `loadDashboard()` deduplica `histProjs` antes de usar
   - `renderHistoricalBanner` usa `122` fixo como total de projetos
   - Contagem de clientes usa Set deduplicado com fallback 73

### Correções anteriores (04/04/2026) — Integração geral

1. **`loadDashboard`** — Adicionado try/catch robusto para `SYNC.getDashboardData()`; fallback automático se SYNC falhar; carrega `histProjs` com `limit=500` para garantir todos os 122 registros; passa `histProjs` para `renderKPIs`

2. **`renderKPIs`** — Corrigido uso do campo `_profit` do SYNC quando disponível; usa `payment_date` como data financeira principal (antes usava `project_date`); NPS exibe `—` quando não há dados; margem e lucro são coloridos dinamicamente

3. **`renderCharts`** — Refatorado com helper `getFinDate(p)` que prioriza `payment_date > project_date > created_at`; Categorias exibem underscores substituídos por espaços (`producao_recorrente` → `PRODUÇÃO RECORRENTE`); Gráfico Lucro/Custo usa `_profit` do SYNC quando disponível

4. **`renderHistoricalBanner`** — Usa `YEAR_SUMMARY` como fonte verdade; lucro exibido apenas para anos com custo registrado; margem global calculada apenas sobre 2022+2023+2024+2026; chips anuais indicam "s/custo" para 2021 e 2025

5. **`renderHistEvolutionChart`** — Linha de Lucro usa `null` (spanGaps=false) para anos sem custo (2021/2025), evitando mostrar lucro=faturamento erroneamente; verifica consistência DB vs planilha (±10%) antes de substituir

6. **`os-historico.js` — `renderYearDashboard`** — Variável `semCusto` para 2021/2025; KPIs de Lucro e Margem exibem "N/D"/"Sem registro" para esses anos; não usa `|| ys0.custo` que causava ambiguidade com 0 falsy

7. **`os-historico.js` — `renderOverallReport`** — Usa `YEAR_SUMMARY` como única fonte de totais (antes podia inflar com dados duplicados do DB); tabela anual exibe "sem registro" para custo/lucro de 2021 e 2025; margem global calculada corretamente

8. **Integração Fechamento→Dashboard** — Confirmado: `saveGasto`, `deleteGasto`, `saveFechamento` e `renderFechSummary` todos chamam `SYNC.onFechamentoSaved` propagando custo real para `age_projects`

9. **Integração Kanban→Projetos→Dashboard** — Confirmado: `patchCard`, `quickMoveStage` e `save()` no Kanban chamam `SYNC.onKanbanStageChanged` que atualiza `age_projects.status`

## 🔗 Sistema de Integração entre Páginas (os-sync.js) — Atualizado 04/04/2026

### Fluxo de dados implementado

```
FECHAMENTO (age_fechamento + age_gastos)
  ↓ ao salvar gasto ou cabeçalho
  → age_projects.cost e .profit_pct atualizados automaticamente (custo real)
  → Dashboard recarrega KPIs com margem e lucro reais
  → Se projeto concluído → age_hist_projects sincronizado
  → age_clients_db recalcula total_value e avg_nps do cliente

PROJETOS (age_projects)
  ↓ ao criar / editar / excluir
  → Dashboard recarrega KPIs e gráficos
  → Kanban (age_project_stages) atualiza card vinculado
  → Se status = concluído → histórico e clientes atualizados automaticamente

KANBAN (age_project_stages)
  ↓ ao arrastar card / clicar próxima etapa / avançar via modal
  → age_projects.status é atualizado em tempo real
  → Mapeamento: reuniao→pendente, pre_producao/orcamento/gravacao/edicao/finalizacao/entrega→em_andamento, postado→concluido
  → Dashboard recarrega automaticamente

HISTÓRICO (age_hist_projects)
  → Enriquecido em tempo real com custos reais do fechamento
  → Inclui projetos ativos concluídos que ainda não estão no histórico

CLIENTES (age_clients_db)
  → Métricas recalculadas a partir de todos os projetos históricos
  → Status automático: ativo (ano atual), recorrente (ano anterior), inativo (mais antigo)
```

### Pontos de integração por página

| Página | Propaga para | Recebe de |
|--------|-------------|-----------|
| Fechamento | Projetos, Histórico, Clientes, Dashboard | Projetos (valor base) |
| Projetos | Dashboard, Kanban, Histórico, Clientes | Fechamento (custo real) |
| Kanban | Projetos (status), Dashboard | Projetos (importação) |
| Histórico | — | Fechamento (enriquece margem/custo) |
| Clientes | — | Histórico (recalcula métricas) |
| Dashboard | — | Todos (lê dados enriquecidos) |

---

## 🚧 Próximos Passos Sugeridos

1. **Preencher custos retroativos** de 2021 e 2025 nas planilhas → re-importar
2. **Coletar NPS** de 2021, 2022, 2025 e 2026 dos projetos ativos
3. **Notificações de prazo** — alertas automáticos para projetos vencidos no Kanban
4. **Relatório de produtividade** — métricas por membro da equipe
5. **Workflow de aprovação** — etapa de aprovação formal no Kanban
6. **Reativação de clientes** — lista de prioridade dos 73 inativos por potencial
7. **Modal de orçamento — melhorias futuras:** duplicar item, reordenar por drag-and-drop, salvar rascunho automático a cada alteração
