# WhatsApp → Age Ops

O cliente fala com **um número da Age Ops**. A função `whatsapp-webhook` reconhece o telefone, pede SIM, e grava no tenant certo (projeto, pagamento, gasto, tarefa, orçamento).

Não é o WhatsApp pessoal da produtora virando API. É o WhatsApp dela **conversando com o app**.

## 1. Banco

No SQL Editor do Supabase:

```text
supabase/sql/age_whatsapp.sql
```

## 2. Publicar a função

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy ai-command
```

O `--no-verify-jwt` é obrigatório: a Meta e a Evolution não mandam o token do usuário. A função valida a assinatura (Meta) ou o `?secret=` (Evolution).

Secrets (Project Settings → Edge Functions → Secrets):

| Secret | Quando |
|---|---|
| `ANTHROPIC_API_KEY` | Já usado pelo assistente |
| `AGE_JWT_SECRET` | Já usado no login |
| `WHATSAPP_PROVIDER` | `meta` ou `evolution` |

### Caminho oficial (Meta Cloud API)

1. [developers.facebook.com](https://developers.facebook.com/) → app **Business** → produto WhatsApp.
2. Número de teste ou número verificado da empresa.
3. Webhook URL:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook
```

Verify token: qualquer string sua, a mesma em `WHATSAPP_VERIFY_TOKEN`.
Inscreva o campo `messages`.

| Secret | Valor |
|---|---|
| `WHATSAPP_TOKEN` | Token permanente do app |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número |
| `WHATSAPP_VERIFY_TOKEN` | O mesmo do painel |
| `WHATSAPP_APP_SECRET` | App secret (valida a assinatura) |

No `age-ops-v4.html`, preencha `WHATSAPP_BOT_NUMBER` com DDI+DDD+número (só dígitos), ex. `5511999999999`.

### Caminho rápido para testar (Evolution API)

Sobe um WhatsApp via QR no seu computador. Serve para **um** número da Age Ops, não para cada cliente escanear o próprio chip.

```bash
cd supabase/whatsapp
cp .env.example .env
# edite EVOLUTION_API_KEY e a URL do webhook
docker compose up -d
```

Abra `http://localhost:8080/manager`, crie a instância `ageops`, escaneie o QR com o chip que vai ser o bot.

| Secret | Valor |
|---|---|
| `WHATSAPP_PROVIDER` | `evolution` |
| `EVOLUTION_API_URL` | URL pública da Evolution (túnel ou VPS) |
| `EVOLUTION_API_KEY` | A mesma do compose |
| `EVOLUTION_INSTANCE` | `ageops` |
| `EVOLUTION_WEBHOOK_SECRET` | Header `x-evolution-secret` |

A Evolution não é a API oficial da Meta. O número pode cair. Para clientes pagando, use Cloud API.

## 3. Como o usuário liga a conta

1. Cria a conta no Age Ops (o WhatsApp do cadastro já entra).
2. Manda um **oi** daquele mesmo número para o bot → liga sozinho.
3. Se for outro chip: **Meu perfil → Gerar código** e manda `vincular 123456`.

Exemplos na conversa:

- `Pagamento 2500 pro João do projeto Nike`
- `Novo projeto Nike Campanha 12 mil prazo 10/09`
- `Gasto 180 uber gravação`
- `Tarefa ligar pro cliente amanhã`
- `Quanto paguei esse mês?`

O bot pede **SIM** antes de gravar. Consultas respondem na hora.
