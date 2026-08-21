# Testes de isolamento

Exercitam `rls_multitenant.sql` num Postgres local, sem depender de projeto
Supabase. Cobrem o que dá para provar sem PostgREST: as políticas, os grants e
o gatilho. A cadeia do token (Edge Function assina → PostgREST valida) só é
verificável em staging.

## Rodar

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
pg_ctl -D /opt/homebrew/var/postgresql@17 -l /tmp/pg.log start

psql -d postgres -q -f supabase/sql/tests/00_fixture.sql
psql -d age_test -v ON_ERROR_STOP=1 -f supabase/sql/multitenant_tabelas_faltantes.sql
psql -d age_test -v ON_ERROR_STOP=1 -f supabase/sql/rls_multitenant.sql
psql -d age_test -f supabase/sql/tests/01_isolamento.sql
psql -d age_test -f supabase/sql/tests/02_escalada.sql
psql -d age_test -f supabase/sql/tests/03_recrutamento.sql
```

A migração entra antes do RLS porque é ela que cria o `company_id` nas
tabelas de recrutamento — sem a coluna, o passo 4 do RLS fecharia essas
tabelas por completo em vez de escopá-las por empresa.

O fixture recria o banco do zero, então dá para repetir à vontade.

## Como ler o resultado

Os `ERROR` esperados fazem parte do teste — são as tentativas de invasão
sendo recusadas. Cada consulta traz na linha acima o resultado esperado.

O que precisa acontecer:

- `anon` recebe *permission denied* em projetos, colaboradores, usuários e
  senhas
- Empresa A vê 2 projetos, empresa B vê 1 — a mesma consulta, resultados
  diferentes
- Gravar carimbando a empresa alheia é recusado pela política
- Token sem `company_id` não enxerga nada
- Convite e campanha NPS respondem ao token exato e a mais nada
- Trocar a própria empresa é recusado pelo gatilho
- `service_role` continua passando por cima de tudo

Uma linha do `02_escalada.sql` diz "esperado: RECUSADO" e devolve `UPDATE 1`:
é o admin gravando `role = 'admin'` sendo já admin. Como o papel não muda, o
gatilho não tem o que barrar. A rotulagem do teste é que está imprecisa; o
caso real de escalada é o do colaborador, logo abaixo, e esse é recusado.

## O que estes testes encontraram

Duas falhas reais na primeira execução:

1. **`age_user_secrets` ficava aberta.** O script pulava a tabela supondo que
   `age_user_secrets.sql` já tivesse sido aplicado. Onde isso não fosse
   verdade, os hashes de senha seguiriam legíveis pela chave anônima. Agora o
   script fecha a tabela por conta própria.

2. **Usuário trocava a própria empresa.** A política `WITH CHECK` só enxerga a
   linha nova, e uma linha com `company_id` da empresa B é perfeitamente
   coerente para quem passaria a ser da empresa B. Bastava um PATCH no próprio
   cadastro para entrar na empresa alheia e ler tudo. Corrigido com o gatilho
   `age_users_guard`, que compara o valor novo com o antigo.

A segunda vale registrar porque é o tipo de furo que passa despercebido numa
leitura do SQL: cada política, isolada, parece correta.

Uma terceira, achada depois, na aba Recrutamento:

3. **View furando o RLS.** `v_age_candidates_admin` era uma view comum, e view
   comum roda com o privilégio de quem a criou — não de quem consulta. Com o
   RLS ligado na tabela, a view continuava devolvendo candidato de todas as
   empresas. O `03_recrutamento.sql` cobre isso; o efeito é fácil de reproduzir
   criando duas views idênticas sobre a mesma tabela protegida, uma com
   `security_invoker = true` e outra sem: a primeira devolve 1 linha, a segunda
   devolve todas. `age_candidates` também não tinha `company_id` nenhum, então
   nem o filtro do front tinha em que se apoiar.
