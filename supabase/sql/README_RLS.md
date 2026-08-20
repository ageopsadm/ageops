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
2. Configurar `AGE_JWT_SECRET` na Edge Function
3. Publicar a Edge Function `auth-login`
4. Publicar o front atualizado (`age-ops-v4.html` **e** `nps.html`)
5. Conferir que o login está emitindo token
6. `rls_multitenant.sql`

Os passos 2 a 4 são retrocompatíveis: enquanto o RLS não for ligado, o app
funciona igual. O passo 6 é o irreversível na prática — por isso, staging.

---

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

Rode `rls_multitenant.sql` **passo a passo**, não de uma vez.

O passo 0 é só diagnóstico e não altera nada: ele lista linhas com
`company_id` nulo. Toda linha nessa lista fica invisível depois. Faça o
backfill antes de continuar.

Entre um passo e outro, use o app. É mais rápido descobrir o que quebrou em
seis etapas do que em uma.

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

## O que este roteiro não cobre

Fechado o isolamento, sobra:

- **Recuperação de senha.** Não existe. Hoje só um admin consegue resetar.
- **Tentativas de login.** Sem limite nem bloqueio; a função só atrasa 400 ms.
- **Portal do cliente.** `age_portal_cliente.sql` tem fluxo público próprio e
  precisa da mesma revisão feita aqui para convites e NPS.
- **LGPD.** Retenção, exclusão de conta e log de auditoria continuam abertos.
