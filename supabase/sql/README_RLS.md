# Ativando o RLS multi-tenant

Roteiro para fechar o buraco de isolamento entre empresas. A ordem importa:
ligar o RLS antes de o app emitir token derruba o acesso de todo mundo.

## O problema que isso resolve

A chave anônima do Supabase está no HTML — é pública por natureza, não tem
como escondê-la. Hoje o filtro por `company_id` acontece no JavaScript, e o
JavaScript roda na máquina do cliente. Na prática, qualquer pessoa com o
endereço do app consegue ler e alterar os dados de todas as empresas com um
`curl`. Nenhuma checagem feita no navegador impede isso.

Depois deste roteiro, quem decide é o Postgres, a partir de um token assinado
que o navegador não consegue forjar.

## Ordem de aplicação

1. `age_user_secrets.sql` (se ainda não rodou)
2. `multitenant_tabelas_faltantes.sql` — **antes do front**, ver abaixo
3. Publicar o front atualizado (`age-ops-v4.html` **e** `nps.html`)
4. Publicar as Edge Functions
5. **Só então** configurar `AGE_JWT_SECRET`
6. Conferir que o login está emitindo token
7. `rls_multitenant.sql`

O passo 2 cria `company_id` em tabelas que ficaram de fora do multi-tenant
(recrutamento, gastos de projeto, catálogo de funções de orçamento) e recria
`v_age_candidates_admin` com `security_invoker`. Ele vem **antes** do front
porque o front novo passa a mandar `company_id=eq.…` nessas tabelas; se a
coluna ainda não existir, o PostgREST responde 400 e as abas quebram.

O segredo vem **depois** das funções, e as funções depois do front. A razão:
`ai-command`, `create-subscription` e `recruit-submit` passam a exigir sessão
no instante em que `AGE_JWT_SECRET` existe. Se o segredo estiver configurado
antes de o front novo estar no ar, o front antigo não manda `x-age-token` e
essas funções param de responder.

Publicar o front antes é seguro: sem token, ele opera exatamente como hoje.

Os passos 2 a 5 são retrocompatíveis: enquanto o RLS não for ligado, o app
funciona igual. O passo 6 é o irreversível na prática.

---

## Parte 0 — Validação local (mais rápida)

Antes do staging, `supabase/sql/tests/` roda as políticas num Postgres local
com duas empresas de mentira. Pega erro de sintaxe e furo de política em
segundos, sem projeto na nuvem. Veja o README de lá.

Não substitui o staging: falta o PostgREST e a Edge Function, ou seja,
justamente a validação do token. Mas elimina os erros mais bobos antes.

Um resultado dessa rodada muda um passo do roteiro: **usuário logado não
consegue mais alterar o próprio `company_id`** (gatilho `age_users_guard`).
O `repairUserTenantCompanyOnLogin` do front, que remendava vínculo de empresa
no login, vai passar a falhar — ele engole o erro, então não quebra o login,
mas deixou de funcionar. Por isso o backfill do passo 0 do SQL não é
opcional: contas com `company_id` nulo não se consertam mais sozinhas.

## Parte 1 — Montar o staging

Um projeto Supabase novo, separado do de produção.

```bash
# Estrutura, sem dados
supabase db dump --db-url "$PROD_DB_URL" --schema public -f schema.sql
psql "$STAGING_DB_URL" -f schema.sql
```

Popule com dados de teste, não com a base real. Você precisa de pelo menos
**duas empresas** para que o teste tenha valor: uma empresa só nunca revela
falha de isolamento.

Sugestão: empresa A com 2 usuários (1 admin, 1 colaborador) e alguns
projetos, e empresa B com 1 admin e projetos próprios.

## Parte 2 — Configurar o segredo do token

Em **Settings → API → JWT Secret**, copie o valor. É com ele que o PostgREST
valida os tokens; um token assinado com outra chave é rejeitado.

```bash
supabase secrets set AGE_JWT_SECRET="<jwt secret do projeto>" --project-ref <ref-do-staging>
supabase functions deploy auth-login --project-ref <ref-do-staging>
```

Sem essa variável a função ainda faz login, mas não emite token, e o app
avisa no console. Nesse estado o RLS **não** pode ser ligado.

## Parte 3 — Conferir a emissão do token

Abra o app apontando para o staging, faça login e no console:

```js
JSON.parse(atob(JSON.parse(localStorage.age_access_token).t.split('.')[1]))
```

Você deve ver `role: "authenticated"`, o `company_id` da empresa do usuário e
um `exp` no futuro. Se `company_id` vier nulo, o usuário está sem empresa
vinculada — corrija antes de seguir, senão ele não enxergará nada.

## Parte 4 — Rodar o RLS

### Onde rodar

**SQL Editor do Supabase** (Dashboard → SQL Editor → New query) é o caminho
mais simples e não depende de CLI. Cole **um passo por vez** e execute.

Ou, se preferir terminal:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/sql/rls_multitenant.sql
```

A string de conexão está em Settings → Database → Connection string (URI).
Ela contém a senha, então exporte numa variável em vez de deixá-la no
histórico do shell.

### Uma limitação do SQL Editor

Ele mostra resultados de consulta, mas **descarta as mensagens de aviso**. Os
passos 2 e 4 anunciam cada tabela tratada via `RAISE NOTICE`, e você não vai
ver nada — parecerá que não fizeram nada. Fizeram; a confirmação vem no passo
6, que devolve o estado de cada tabela em forma de tabela.

Por isso o passo 0 foi escrito como consulta, e não como aviso: ele precisa
ser visível.

### Ordem

Rode **passo a passo**, não o arquivo inteiro de uma vez. É mais rápido
descobrir o que quebrou em seis etapas do que em uma.

O passo 0 não altera nada: lista as linhas com `company_id` nulo, que ficam
invisíveis depois do RLS. Se a coluna `situacao` disser `BACKFILL ANTES` em
alguma tabela, resolva antes de continuar — e lembre que essas contas não se
consertam mais sozinhas no login.

Entre um passo e outro, use o app.

## Parte 5 — Testes que precisam passar

**Isolamento (o motivo de tudo isto):**

- [ ] Admin da empresa A não vê nenhum projeto da empresa B
- [ ] Com o token de A, forçar `company_id` de B numa gravação é recusado
- [ ] Sem token (só chave anônima), a API não devolve nenhuma linha:

```bash
curl "$URL/rest/v1/age_projects?select=id" -H "apikey: $ANON"
# esperado: []
```

Esse último teste é a prova real. Se voltar dados, o RLS não está valendo.

**Funcionamento normal:**

- [ ] Login, dashboard com números, criar/editar/excluir projeto
- [ ] Orçamentos, pagamentos, fluxo de caixa, tarefas, calendário
- [ ] Colaborador enxerga só o que o papel dele permite
- [ ] Cadastro novo pelo site cria empresa isolada e já entra logado
- [ ] Convite: gerar link, abrir deslogado, aceitar, cair no app
- [ ] Trocar a senha no perfil
- [ ] Upload de contrato
- [ ] NPS: abrir o link público e responder

**Sessão:**

- [ ] F5 mantém logado
- [ ] Sair limpa o token (`localStorage.age_access_token` some)
- [ ] Token vencido leva ao login, não a uma tela vazia

## Parte 6 — Produção

Faça em janela de baixo movimento e avise os usuários: **todo mundo precisa
entrar de novo**, porque as sessões antigas não têm token.

1. Backup (Database → Backups) antes de qualquer coisa
2. `AGE_JWT_SECRET` no projeto de produção
3. Deploy da `auth-login`
4. Deploy do front
5. Login de teste com uma conta real, conferindo o token
6. `rls_multitenant.sql`, passo a passo
7. Repetir os testes da Parte 5

### Se der errado

Para destravar o acesso rapidamente, desligue o RLS das tabelas afetadas:

```sql
do $$
declare r record;
begin
  for r in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name like 'age\_%'
  loop
    execute format('alter table public.%I disable row level security', r.table_name);
  end loop;
end $$;
```

Isso reabre a exposição — é medida de emergência, para ganhar tempo, não
solução. As políticas continuam criadas e voltam com `enable`.

---

## Edge Functions protegidas

Junto com o RLS, as outras funções passaram a exigir sessão. Elas leem o
token no header `x-age-token` e usam o mesmo `AGE_JWT_SECRET`.

| Função | Antes | Agora |
| --- | --- | --- |
| `pagarme-webhook` | aceitava qualquer POST | exige assinatura HMAC válida |
| `ai-command` | aberta | exige sessão |
| `create-subscription` | aberta | exige sessão |
| `recruit-submit` | aberta | envio segue público; `analyze` exige sessão e confina à empresa |

O webhook era o pior caso: sem conferir a origem, bastava um POST com
`status: paid` para liberar uma assinatura. Agora ele recalcula o HMAC sobre
o corpo cru e compara em tempo constante, aceitando tanto `X-Hub-Signature`
(HMAC-SHA1, API v1) quanto `X-Hub-Signature-256` (HMAC-SHA256, v5).

```bash
supabase secrets set PAGARME_WEBHOOK_SECRET="<secret do webhook>"
```

Sem esse secret a função **recusa tudo** e devolve 500 — falha fechada, de
propósito. Na API v1 o segredo é a própria chave de API; se você não definir
`PAGARME_WEBHOOK_SECRET`, ela cai em `PAGARME_API_KEY`.

Enquanto `AGE_JWT_SECRET` não estiver configurado, as outras três seguem
abertas para não quebrar o app antes do deploy — mais um motivo para
configurar o secret junto com o resto.

Teste depois do deploy: um POST sem assinatura no webhook precisa responder
401, e o app logado precisa continuar usando o assistente normalmente.

## Cuidado permanente: views e tabelas novas

Duas armadilhas já morderam o projeto e vão voltar se ninguém checar:

**Views não herdam o RLS.** Uma view roda com o privilégio de quem a criou,
não de quem consulta. Foi assim que `v_age_candidates_admin` mostrou os
candidatos da OWNAGE para outra conta mesmo com a tabela protegida. Toda view
nova precisa de `WITH (security_invoker = true)`.

**Tabela nova precisa entrar em dois lugares:** ganhar a coluna `company_id`
(o `rls_multitenant.sql` cobre sozinho quem tem a coluna) e entrar em
`TENANT_SCOPED_TABLES` no `age-ops-v4.html`.

Para achar o que escapou, compare o que o front lê com o que está escopado:

```bash
rg -o "(?:apiGet|fetchAll)\('(age_[a-z_]+|v_age_[a-z_]+)'" age-ops-v4.html -r '$1' | sort -u
```

E no banco, listar views sem `security_invoker`:

```sql
SELECT c.relname, c.reloptions
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind = 'v' AND n.nspname = 'public'
   AND (c.reloptions IS NULL OR NOT ('security_invoker=true' = ANY(c.reloptions)));
```

## O que este roteiro não cobre

Fechado o isolamento, sobra:

- **Recuperação de senha.** Não existe. Hoje só um admin consegue resetar.
- **Tentativas de login.** Sem limite nem bloqueio; a função só atrasa 400 ms.
- **Portal do cliente.** `age_portal_cliente.sql` tem fluxo público próprio e
  precisa da mesma revisão feita aqui para convites e NPS.
- **LGPD.** Retenção, exclusão de conta e log de auditoria continuam abertos.
